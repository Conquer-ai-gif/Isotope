import { createAgent, type Message } from '@inngest/agent-kit'
import { getOpenRouterModel } from '@/lib/openrouter'
import * as Sentry from '@sentry/nextjs'

import { inngest } from './client'
import { getSandbox, parseAgentOutput } from './utils'
import { resetFreeCredits } from '@/lib/usage'
import { prisma } from '@/lib/db'
import {
  FRAGMENT_TITLE_PROMPT,
  RESPONSE_PROMPT,
  DESIGN_LIBRARY,
  BACKEND_AGENT_PROMPT,
  ARCHITECTURE_MAP_PROMPT,
} from '@/prompt'

import { getOrCreateSandbox, restoreFilesIntoSandbox, runTsc } from '@/sandbox/sandboxManager'
import { createDbEmitter } from '@/lib/generationEvents'
import { makeEvent } from '@/streaming/events'
import { figmaToTailwindConfig } from '@/lib/figma'
import { generateTaskGraph } from '@/planning/planner'
import { runCodeAgent } from '@/agents/codeAgent'
import { runFixAgent } from '@/agents/fixAgent'
import { upsertFilesToVectorStore, searchSimilarComponents, formatComponentMatches } from '@/lib/vector-store'
import { generateBranchName, smartPushToGitHub } from '@/lib/github'

import { TaskExecutor } from '@/execution/TaskExecutor'
import type { Task, TaskGraph } from '@/execution/taskGraph'
import type { AgentRunner, ExecutionContext } from '@/execution/TaskExecutor'

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildTaskPrompt(
  task: Task,
  userRequest: string,
  imageData?: { mimeType: string; base64: string },
  contextSuffix = '',
): string | unknown[] {
  const text =
    `USER REQUEST: ${userRequest}\n\n` +
    `YOUR TASK (${task.type}): ${task.description}\n\n` +
    `ALLOWED FILES — modify only these paths:\n${task.files.map((f) => `- ${f}`).join('\n') || '(none specified — use judgment)'}\n\n` +
    contextSuffix

  if (imageData) {
    return [
      { type: 'image', image: imageData.base64, mimeType: imageData.mimeType },
      { type: 'text', text },
    ]
  }
  return text
}

function buildSystemSuffix(taskType: Task['type'], contextSuffix: string): string {
  switch (taskType) {
    case 'ui':
      return DESIGN_LIBRARY + contextSuffix
    case 'backend':
      return '\n\n' + BACKEND_AGENT_PROMPT + contextSuffix
    default:
      return contextSuffix
  }
}

// ─── main function ────────────────────────────────────────────────────────────

export const codeAgentFunction = inngest.createFunction(
  { id: 'code-agent' },
  { event: 'code-agent/run' },
  async ({ event, step }) => {
    const { messageId, projectId, value, imageUrl } = event.data as {
      messageId: string
      projectId: string
      value: string
      imageUrl?: string
      supabaseUrl?: string
      supabaseAnonKey?: string
    }

    // ── Check current plan status ─────────────────────────────────────────────
    const existingMessage = await step.run('check-plan-status', async () =>
      prisma.message.findUnique({
        where: { id: messageId },
        select: { planStatus: true, plan: true },
      }),
    )

    // ════════════════════════════════════════════════════════════════════════════
    // PLAN PHASE — runs before user approves
    // ════════════════════════════════════════════════════════════════════════════

    if (!existingMessage?.planStatus || existingMessage.planStatus === 'pending') {

      // 1. Get or create persistent sandbox for this project
      const planSandboxId = await step.run('plan-get-sandbox', async () => {
        const { sandboxId } = await getOrCreateSandbox(projectId)
        return sandboxId
      })

      // 2. Restore most-recent files into sandbox for context
      await step.run('plan-restore-files', async () =>
        restoreFilesIntoSandbox(projectId, planSandboxId),
      )

      // 3. Generate Zod-validated task graph
      const taskGraph = await step.run('generate-task-graph', async () =>
        generateTaskGraph({ sandboxId: planSandboxId, userRequest: value }),
      )

      // 4. Persist plan — UI will show it and await user approval
      await step.run('store-plan', async () =>
        prisma.message.update({
          where: { id: messageId },
          data: { plan: JSON.stringify(taskGraph), planStatus: 'pending' },
        }),
      )

      return { status: 'awaiting_approval', messageId }
    }

    if (existingMessage.planStatus === 'rejected') {
      return { status: 'rejected', messageId }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // CODING PHASE — runs after user approves plan
    // ════════════════════════════════════════════════════════════════════════════

    // Parse the approved task graph
    let taskGraphData: TaskGraph = { tasks: [] }
    try {
      taskGraphData = JSON.parse(existingMessage.plan ?? '{}') as TaskGraph
    } catch {
      /* fall through with empty tasks — fallback to single-agent mode below */
    }
    const tasks: Task[] = taskGraphData?.tasks ?? []

    // 1. Persistent sandbox (reuses planning sandbox if still alive)
    const sandboxId = await step.run('exec-get-sandbox', async () => {
      const { sandboxId: id } = await getOrCreateSandbox(projectId)
      return id
    })

    // 2. Restore files (from last fragment OR seed from connected GitHub repo)
    const restoredFiles = await step.run('exec-restore-files', async () =>
      restoreFilesIntoSandbox(projectId, sandboxId),
    )

    // 3. Write Figma tailwind config if env vars are set
    await step.run('write-figma-tailwind-config', async () => {
      const figmaFileKey = process.env.FIGMA_FILE_KEY
      const figmaToken = process.env.FIGMA_ACCESS_TOKEN
      if (!figmaFileKey || !figmaToken) return 'skipped: no figma config'
      try {
        const tailwindConfig = await figmaToTailwindConfig(figmaFileKey, figmaToken)
        const sandbox = await getSandbox(sandboxId)
        await sandbox.files.write('tailwind.config.ts', tailwindConfig)
        return 'figma tailwind config written'
      } catch (e) {
        return `figma tailwind config failed: ${e}`
      }
    })

    // 4. Look up user plan to select the correct AI model
    const userPlan = await step.run('get-user-plan', async () => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { userId: true },
      })
      if (!project?.userId) return 'free'
      const credits = await prisma.credits.findUnique({
        where: { userId: project.userId },
        select: { plan: true },
      })
      return credits?.plan ?? 'free'
    })

    // 4b. Project context (supabase, architecture map)
    const projectContext = await step.run('get-project-context', async () =>
      prisma.project.findUnique({
        where: { id: projectId },
        select: { contextDocument: true, supabaseUrl: true, supabaseAnonKey: true },
      }),
    )

    // 5. Conversation history (last 6 messages, older ones summarized)
    const previousMessages = await step.run('get-previous-messages', async () => {
      const all = await prisma.message.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      })
      if (all.length > 8) {
        const old = all.slice(0, all.length - 6)
        const recent = all.slice(all.length - 6)
        const summary = old
          .filter((m: { role: string; content: string }) => m.role === 'ASSISTANT' && m.content.length > 10)
          .map((m: { content: string }) => m.content.slice(0, 200))
          .join(' | ')
        const formatted: { type: string; role: string; content: string }[] = []
        if (summary) {
          formatted.push({ type: 'text', role: 'user', content: `[Earlier context: ${summary}]` })
        }
        for (const m of recent) {
          formatted.push({ type: 'text', role: m.role === 'ASSISTANT' ? 'assistant' : 'user', content: m.content })
        }
        return formatted
      }
      return all.map((m: { role: string; content: string }) => ({
        type: 'text',
        role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
        content: m.content,
      }))
    })

    // 6. Similar components from vector store (if supabase configured)
    const similarComponents = await step.run('search-components-for-coding', async () => {
      if (!projectContext?.supabaseUrl || !projectContext?.supabaseAnonKey) return ''
      try {
        const matches = await searchSimilarComponents({
          projectId,
          query: value,
          supabaseUrl: projectContext.supabaseUrl,
          supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? projectContext.supabaseAnonKey,
        })
        return formatComponentMatches(matches)
      } catch {
        return ''
      }
    })

    // 7. Build shared context suffix
    const supabaseCtx = (() => {
      const url = projectContext?.supabaseUrl ?? (event.data as Record<string, string>).supabaseUrl
      const key = projectContext?.supabaseAnonKey ?? (event.data as Record<string, string>).supabaseAnonKey
      if (!url || !key) return ''
      return `\n\nSupabase is available:\n- NEXT_PUBLIC_SUPABASE_URL="${url}"\n- NEXT_PUBLIC_SUPABASE_ANON_KEY="${key}"\nUse @supabase/supabase-js. Install with terminal if needed.`
    })()

    const archCtx = projectContext?.contextDocument
      ? `\n\n<architecture_map>\n${projectContext.contextDocument}\n</architecture_map>`
      : ''

    const contextSuffix = supabaseCtx + archCtx + (similarComponents ?? '')

    // 8. Parse image attachment
    let imageData: { mimeType: string; base64: string } | undefined
    if (imageUrl) {
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (match) imageData = { mimeType: match[1], base64: match[2] }
    }

    // ── Set up real-time event emitter ───────────────────────────────────────
    const emit = createDbEmitter(messageId)

    // ── Shared mutable state (captured by closures below) ────────────────────
    // NOTE: network.run() + tool steps must remain OUTSIDE step.run().
    // Agent Kit's tool handler receives its own step context (toolStep)
    // which conflicts with Inngest's outer step.run() context.

    // Start with restored files — the agent sees the full existing codebase
    // from the start, whether that's a prior generation or a seeded GitHub repo.
    let allFiles: Record<string, string> = restoredFiles.files ?? {}
    const summaries: string[] = []

    // ── Build the AgentRunner used by TaskExecutor ────────────────────────────
    // One runner handles all task types — the system suffix is varied by type.
    const makeRunner = (): AgentRunner => ({
      async run(task: Task, ctx: ExecutionContext): Promise<void> {
        const result = await runCodeAgent({
          sandboxId: ctx.sandboxId,
          userPrompt: buildTaskPrompt(task, value, imageData, contextSuffix),
          history: previousMessages as unknown as Message[],
          allowedFiles: task.files.length > 0 ? task.files : undefined,
          initialFiles: allFiles,
          systemSuffix: buildSystemSuffix(task.type, contextSuffix),
          emit: ctx.emit,
          userPlan,
        })

        allFiles = { ...allFiles, ...result.files }
        if (result.summary) summaries.push(result.summary)
      },
    })

    // ── Per-task TypeScript validation ────────────────────────────────────────
    // Runs after every task completes. Only checks the files that task owned.
    // If errors are found, the fix agent is scoped to those files only.
    const validateTask = async (task: Task, ctx: ExecutionContext): Promise<void> => {
      if (task.files.length === 0) return

      const errors = await runTsc(ctx.sandboxId, task.files)
      if (!errors) return

      emit(makeEvent('validation_failed', { taskId: task.id, data: { errors: errors.slice(0, 300) } }))

      const fixResult = await runFixAgent({
        sandboxId: ctx.sandboxId,
        existingFiles: allFiles,
        failingFiles: task.files,
        emit: ctx.emit,
        userPlan,
      })

      allFiles = { ...allFiles, ...fixResult.files }

      emit(makeEvent('fix_completed', { taskId: task.id }))
    }

    // ── Execute via TaskExecutor ──────────────────────────────────────────────
    const execContext: ExecutionContext = { sandboxId, tools: {}, emit }

    const taskGraphToRun: TaskGraph = tasks.length > 0
      ? taskGraphData
      : {
          tasks: [{
            id: 'task_1',
            type: 'ui',
            description: value,
            files: [],
            dependsOn: [],
            priority: 1,
          }],
        }

    const runner = makeRunner()
    const executor = new TaskExecutor(taskGraphToRun, execContext, {
      maxRetries: 3,
      agents: {
        ui: runner,
        backend: runner,
        db: runner,
        integration: runner,
      },
      validate: validateTask,
    })

    // TaskExecutor emits generation_started, generation_completed, and generation_failed
    // internally. We only need to catch the throw so Inngest doesn't mark the run as failed.
    let executorFailed = false
    try {
      await executor.run()
    } catch (err) {
      executorFailed = true
      Sentry.captureException(err, { extra: { context: 'TaskExecutor.run', projectId } })
    }

    const combinedSummary = summaries
      .map((s) => s.trim())
      .join('\n')
    // executorFailed captures the authoritative result from TaskExecutor.
    // We also guard against the edge case where no summary or files were produced
    // even if the executor didn't throw (e.g. all tasks were no-ops).
    const isError = executorFailed || summaries.length === 0 || Object.keys(allFiles).length === 0

    // ── Generate response title + message (no tools → safe outside step) ──────
    const fragmentTitleGenerator = createAgent({
      name: 'fragment-title-generator',
      system: FRAGMENT_TITLE_PROMPT,
      model: getOpenRouterModel('free'),
    })
    const responseGenerator = createAgent({
      name: 'response-generator',
      system: RESPONSE_PROMPT,
      model: getOpenRouterModel('free'),
    })

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(combinedSummary || 'No summary')
    const { output: responseOutput } = await responseGenerator.run(combinedSummary || 'No summary')

    // ── Sandbox URL ───────────────────────────────────────────────────────────
    const sandboxUrl = await step.run('get-sandbox-url', async () => {
      const sandbox = await getSandbox(sandboxId)
      const host = sandbox.getHost(3000)
      return `https://${host}`
    })

    // ── Persist result ────────────────────────────────────────────────────────
    await step.run('save-result', async () => {
      if (isError) {
        return prisma.message.create({
          data: {
            projectId,
            content: 'Something went wrong — please try again',
            role: 'ASSISTANT',
            type: 'ERROR',
          },
        })
      }
      return prisma.message.create({
        data: {
          projectId,
          content: parseAgentOutput(responseOutput),
          role: 'ASSISTANT',
          type: 'RESULT',
          fragment: {
            create: {
              sandboxUrl,
              title: parseAgentOutput(fragmentTitleOutput),
              files: allFiles,
            },
          },
        },
      })
    })

    // ── Update architecture map (contextDocument) ─────────────────────────────
    await step.run('update-architecture-map', async () => {
      if (isError) return 'skipped: error state'
      const mapAgent = createAgent({
        name: 'architecture-map-agent',
        system: ARCHITECTURE_MAP_PROMPT,
        model: getOpenRouterModel('free'),
      })
      const fileList = Object.entries(allFiles)
        .map(([path, content]) => `<file path="${path}">\n${content.slice(0, 2000)}\n</file>`)
        .join('\n')
      const { output: mapOutput } = await mapAgent.run(`<files>\n${fileList}\n</files>`)
      const mapText = mapOutput
        .filter((m: Message) => m.type === 'text')
        .map((m: Message) =>
          Array.isArray(m.content) ? m.content.map((c) => c.text).join('') : m.content,
        )
        .join('')
      const cleanMap = mapText.replace(/```json|```/g, '').trim()
      await prisma.project.update({ where: { id: projectId }, data: { contextDocument: cleanMap } })
      return 'architecture map updated'
    })

    // ── Upsert files into vector store ────────────────────────────────────────
    await step.run('upsert-vector-store', async () => {
      if (isError) return 'skipped: error state'
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { supabaseUrl: true, supabaseAnonKey: true },
      })
      if (!project?.supabaseUrl || !project?.supabaseAnonKey) return 'skipped: no supabase'
      try {
        await upsertFilesToVectorStore({
          projectId,
          files: allFiles,
          supabaseUrl: project.supabaseUrl,
          supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? project.supabaseAnonKey,
        })
        return `upserted ${Object.keys(allFiles).length} files`
      } catch (e) {
        Sentry.captureException(e, { extra: { context: 'upsert-vector-store', projectId } })
        return `upsert failed: ${e}`
      }
    })

    // ── Smart diff push to GitHub ─────────────────────────────────────────────
    await step.run('sync-to-github', async () => {
      if (isError) return 'skipped: error state'
      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project?.repoOwner || !project?.repoName) return 'skipped: no repo bound'
      const { getGitHubToken } = await import('@/lib/github-token')
      const githubToken = await getGitHubToken(project.userId)
      if (!githubToken) return 'skipped: no github token'
      if (Object.keys(allFiles).length === 0) return 'skipped: no files'
      const title = parseAgentOutput(fragmentTitleOutput)
      const branchName = generateBranchName(title || value)
      try {
        const pushResult = await smartPushToGitHub({
          accessToken: githubToken.accessToken,
          owner: project.repoOwner,
          repo: project.repoName,
          branchName,
          newFiles: allFiles,
          taskSummary: combinedSummary || title,
          autoMerge: false,
        })
        if (pushResult.filesChanged === 0) return 'skipped: no files changed'
        const latestMsg = await prisma.message.findFirst({
          where: { projectId, role: 'ASSISTANT', type: 'RESULT' },
          orderBy: { createdAt: 'desc' },
          include: { fragment: true },
        })
        if (latestMsg?.fragment) {
          await prisma.fragment.update({ where: { id: latestMsg.fragment.id }, data: { branchName } })
        }
        await prisma.project.update({ where: { id: project.id }, data: { lastSyncedAt: new Date() } })
        return `pushed ${pushResult.filesChanged} file(s) to branch: ${branchName}`
      } catch (e) {
        Sentry.captureException(e, { extra: { context: 'smart github push', projectId } })
        return `github push failed: ${e}`
      }
    })

    // ── Refresh Vercel deploy URL ─────────────────────────────────────────────
    await step.run('refresh-vercel-url', async () => {
      if (isError) return 'skipped'
      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project?.vercelProjectId) return 'skipped: no vercel project'
      await new Promise((r) => setTimeout(r, 10_000))
      try {
        const { getLatestDeployUrl } = await import('@/lib/vercel')
        const deployUrl = await getLatestDeployUrl(project.vercelProjectId)
        if (!deployUrl) return 'no deployment found yet'
        await prisma.project.update({ where: { id: project.id }, data: { vercelDeployUrl: deployUrl } })
        const latestMsg = await prisma.message.findFirst({
          where: { projectId, role: 'ASSISTANT', type: 'RESULT' },
          orderBy: { createdAt: 'desc' },
          include: { fragment: true },
        })
        if (latestMsg?.fragment) {
          await prisma.fragment.update({ where: { id: latestMsg.fragment.id }, data: { deployUrl } })
        }
        return `updated: ${deployUrl}`
      } catch (e) {
        return `vercel refresh failed: ${e}`
      }
    })

    return { url: sandboxUrl, files: allFiles, summary: combinedSummary }
  },
)

// ── Daily free-credit top-up cron ─────────────────────────────────────────────

export const freeCreditsResetFunction = inngest.createFunction(
  { id: 'free-credits-reset' },
  { cron: '0 0 * * *' },
  async ({ step }) => {
    const count = await step.run('reset-free-credits', async () => resetFreeCredits())
    return { message: `Reset credits for ${count} free user(s)` }
  },
)
