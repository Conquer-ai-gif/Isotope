import { createAgent, createNetwork } from '@inngest/agent-kit'
import * as Sentry from '@sentry/nextjs'
import { TASK_GRAPH_PLAN_PROMPT } from '@/prompt'
import { retryValidatePlan } from './validation'
import { getSandbox } from '@/sandbox/sandboxManager'
import { openRouterModel } from '@/lib/openrouter'
import type { TaskGraph } from '@/execution/taskGraph'

export interface PlannerOptions {
  sandboxId: string
  userRequest: string
}

async function scanExistingFiles(sandboxId: string): Promise<string> {
  try {
    const sandbox = await getSandbox(sandboxId)

    const findResult = await sandbox.commands.run(
      'find /home/user -type f ' +
        '! -path "*/node_modules/*" ' +
        '! -path "*/.next/*" ' +
        '! -path "*/.git/*" ' +
        '! -name "*.lock" ' +
        '! -name "*.ico" ' +
        '! -name "*.png" ' +
        '! -name "*.jpg" ' +
        '! -name "*.svg" ' +
        '| sort',
      { timeout: 10000 },
    )

    const filePaths = findResult.stdout
      .split('\n')
      .map((p: string) => p.trim())
      .filter(Boolean)

    if (filePaths.length === 0) return '<existing_files>none</existing_files>'

    const fileContents: string[] = []
    for (const filePath of filePaths) {
      try {
        const content = await sandbox.files.read(filePath)
        const truncated =
          content.length > 8000 ? content.slice(0, 8000) + '\n... (truncated)' : content
        fileContents.push(`<file path="${filePath}">\n${truncated}\n</file>`)
      } catch {
        // Unreadable — skip
      }
    }

    return `<existing_files>\n${fileContents.join('\n\n')}\n</existing_files>`
  } catch (err) {
    Sentry.captureException(err, { extra: { context: 'scanExistingFiles', sandboxId } })
    return '<existing_files>error reading files</existing_files>'
  }
}

export async function generateTaskGraph(options: PlannerOptions): Promise<TaskGraph> {
  const { sandboxId, userRequest } = options

  const existingFilesContext = await scanExistingFiles(sandboxId)

  const generateRaw = async (): Promise<string> => {
    const planAgent = createAgent({
      name: 'plan-agent',
      description: 'Converts a user request into a validated task graph',
      system: TASK_GRAPH_PLAN_PROMPT,
      model: openRouterModel,
    })

    const planNetwork = createNetwork({
      name: 'plan-network',
      agents: [planAgent],
      maxIter: 1,
    })

    const planInput = `${existingFilesContext}\n\n<user_request>\n${userRequest}\n</user_request>`
    const { output } = await planNetwork.run(planInput)

    return output
      .filter((m: { type: string }) => m.type === 'text')
      .map((m: { content: string | Array<{ text: string }> }) =>
        Array.isArray(m.content) ? m.content.map((c) => c.text).join('') : m.content,
      )
      .join('')
  }

  return retryValidatePlan(generateRaw)
}
