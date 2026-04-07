import {
  createAgent,
  createNetwork,
  createState,
} from '@inngest/agent-kit'
import { gemini } from '@inngest/agent-kit'
import { PROMPT } from '@/prompt'
import { createTools, type AgentState } from '@/tools/createTools'
import { lastAssistantTextMessageContent } from '@/inngest/utils'
import { getSandbox } from '@/sandbox/sandboxManager'
import * as Sentry from '@sentry/nextjs'
import type { EventEmitterFn } from '@/streaming/events'
import { makeEvent } from '@/streaming/events'

const MAX_FIX_RETRIES = 3

export interface RunFixAgentOptions {
  sandboxId: string
  existingFiles: Record<string, string>
  allowedFiles?: string[]
  emit?: EventEmitterFn
}

export interface FixAgentResult {
  fixed: boolean
  files: Record<string, string>
  remainingErrors?: string
}

async function detectErrors(sandboxId: string): Promise<string> {
  try {
    const sandbox = await getSandbox(sandboxId)
    const result = await sandbox.commands.run(
      'npx tsc --noEmit 2>&1 | grep -E "error TS|Cannot find|is not assignable|does not exist" | head -20; ' +
        'cat /tmp/next-error.log 2>/dev/null | head -20 || true',
      { timeout: 15000 },
    )
    return result.stdout.trim()
  } catch {
    return ''
  }
}

export async function runFixAgent(options: RunFixAgentOptions): Promise<FixAgentResult> {
  const { sandboxId, existingFiles, allowedFiles, emit } = options

  let currentFiles = { ...existingFiles }

  for (let attempt = 1; attempt <= MAX_FIX_RETRIES; attempt++) {
    const errors = await detectErrors(sandboxId)

    if (!errors || errors.length < 10) {
      return { fixed: true, files: currentFiles }
    }

    emit?.(
      makeEvent('fix_started', {
        data: { attempt, errors: errors.slice(0, 500) },
      }),
    )

    const tools = createTools({ sandboxId, allowedFiles, emit })
    const fixState = createState<AgentState>(
      { summary: '', files: currentFiles },
      { messages: [] },
    )

    const fixPrompt = `The app has compilation errors. Fix them silently — do NOT explain, just fix and output <task_summary> when done.

Errors:
${errors.slice(0, 2000)}

Fix all errors by updating the relevant files. Do not change functionality — only fix what is broken.`

    const agent = createAgent<AgentState>({
      name: 'fix-agent',
      system: PROMPT,
      model: gemini({ model: 'gemini-2.0-flash' }),
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

    const network = createNetwork<AgentState>({
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
        extra: { context: `fixAgent attempt ${attempt}`, sandboxId },
      })
    }

    emit?.(makeEvent('fix_completed', { data: { attempt } }))
  }

  const remainingErrors = await detectErrors(sandboxId)
  return {
    fixed: !remainingErrors || remainingErrors.length < 10,
    files: currentFiles,
    remainingErrors,
  }
}
