import {
  createAgent,
  createNetwork,
  createState,
} from '@inngest/agent-kit'
import { PROMPT } from '@/prompt'
import { createTools, type AgentState } from '@/tools/createTools'
import { lastAssistantTextMessageContent } from '@/inngest/utils'
import { getSandbox } from '@/sandbox/sandboxManager'
import { getOpenRouterModel } from '@/lib/openrouter'
import * as Sentry from '@sentry/nextjs'
import type { EventEmitterFn } from '@/streaming/events'
import { makeEvent } from '@/streaming/events'

const MAX_FIX_RETRIES = 3

export interface RunFixAgentOptions {
  sandboxId: string
  existingFiles: Record<string, string>
  /**
   * Limit error detection and fixes to these specific file paths.
   * When omitted, the fix agent checks and fixes the entire project.
   */
  failingFiles?: string[]
  allowedFiles?: string[]
  emit?: EventEmitterFn
  userPlan?: string
}

export interface FixAgentResult {
  fixed: boolean
  files: Record<string, string>
  remainingErrors?: string
}

async function detectErrors(sandboxId: string, files: string[] = []): Promise<string> {
  try {
    const sandbox = await getSandbox(sandboxId)

    const result = await sandbox.commands.run(
      'npx tsc --noEmit 2>&1 | grep -E "error TS|Cannot find|is not assignable|does not exist" | head -20; ' +
        'cat /tmp/next-error.log 2>/dev/null | head -20 || true',
      { timeoutMs: 15000 },
    )

    const output = result.stdout.trim()
    if (!output) return ''

    // When specific files are requested, filter to only their errors
    if (files.length === 0) return output

    return output
      .split('\n')
      .filter((line) => files.some((f) => line.includes(f)))
      .join('\n')
      .trim()
  } catch {
    return ''
  }
}

export async function runFixAgent(options: RunFixAgentOptions): Promise<FixAgentResult> {
  const { sandboxId, existingFiles, failingFiles, allowedFiles, emit, userPlan = 'free' } = options

  // When failingFiles is set, scope the fix to only those files
  const effectiveAllowedFiles = failingFiles ?? allowedFiles

  let currentFiles = { ...existingFiles }

  for (let attempt = 1; attempt <= MAX_FIX_RETRIES; attempt++) {
    const errors = await detectErrors(sandboxId, failingFiles)

    if (!errors || errors.length < 10) {
      return { fixed: true, files: currentFiles }
    }

    emit?.(
      makeEvent('fix_started', {
        data: { attempt, errors: errors.slice(0, 500) },
      }),
    )

    const tools = createTools({ sandboxId, allowedFiles: effectiveAllowedFiles, emit })
    const fixState = createState<AgentState>(
      { summary: '', files: currentFiles },
      { messages: [] },
    )

    const scopeNote = failingFiles && failingFiles.length > 0
      ? `\n\nFocus ONLY on these files:\n${failingFiles.map((f) => `- ${f}`).join('\n')}\n`
      : ''

    const fixPrompt = `The app has compilation errors. Fix them silently — do NOT explain, just fix and output <task_summary>brief description of what was fixed</task_summary> when done.${scopeNote}
Errors:
${errors.slice(0, 2000)}

Fix all errors by updating the relevant files. Do not change functionality — only fix what is broken.`

    const agent = createAgent({
      name: 'fix-agent',
      system: PROMPT,
      model: getOpenRouterModel(userPlan),
      tools: [tools.createOrUpdateFiles, tools.readFiles],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastMsg = lastAssistantTextMessageContent(result)
          if (lastMsg && network && lastMsg.includes('<task_summary>')) {
            network.state.data.summary = lastMsg
          }
          return result
        },
      },
    })

    const network = createNetwork({
      name: 'fix-agent-network',
      agents: [agent],
      maxIter: 5,
      defaultState: fixState,
      router: async ({ network: net }) => {
        if (net.state.data.summary) return
        return agent
      },
    })

    try {
      const result = await network.run(fixPrompt, { state: fixState })
      if (result.state.data.files && Object.keys(result.state.data.files).length > 0) {
        currentFiles = { ...currentFiles, ...result.state.data.files }
      }
    } catch (err) {
      Sentry.captureException(err, {
        extra: {
          context: 'runFixAgent',
          attempt,
          sandboxId,
          failingFiles,
        },
      })
    }
  }

  const remainingErrors = await detectErrors(sandboxId, failingFiles)
  return {
    fixed: !remainingErrors || remainingErrors.length < 10,
    files: currentFiles,
    remainingErrors: remainingErrors || undefined,
  }
}
