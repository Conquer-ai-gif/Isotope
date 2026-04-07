import {
  createAgent,
  createNetwork,
  createState,
  type Message,
} from '@inngest/agent-kit'
import { PROMPT } from '@/prompt'
import { createTools, type AgentState } from '@/tools/createTools'
import { lastAssistantTextMessageContent } from '@/inngest/utils'
import { getOpenRouterModel } from '@/lib/openrouter'
import type { EventEmitterFn } from '@/streaming/events'

export interface RunCodeAgentOptions {
  sandboxId: string
  userPrompt: string | unknown[]
  history: Message[]
  systemSuffix?: string
  allowedFiles?: string[]
  initialFiles?: Record<string, string>
  emit?: EventEmitterFn
  userPlan?: string
}

export interface CodeAgentResult {
  summary: string
  files: Record<string, string>
}

export async function runCodeAgent(options: RunCodeAgentOptions): Promise<CodeAgentResult> {
  const { sandboxId, userPrompt, history, systemSuffix = '', allowedFiles, initialFiles = {}, emit, userPlan = 'free' } = options

  const tools = createTools({ sandboxId, allowedFiles, emit })
  const state = createState<AgentState>(
    { summary: '', files: initialFiles },
    { messages: history },
  )

  const agent = createAgent<AgentState>({
    name: 'code-agent',
    description: 'Builds and modifies Next.js applications inside the sandbox',
    system: PROMPT + systemSuffix,
    model: getOpenRouterModel(userPlan),
    tools: [tools.terminal, tools.createOrUpdateFiles, tools.readFiles],
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
    name: 'code-agent-network',
    agents: [agent],
    maxIter: 15,
    defaultState: state,
    router: async ({ network: net }) => {
      if (net.state.data.summary) return
      return agent
    },
  })

  const result = await network.run(userPrompt as string, { state })

  return {
    summary: result.state.data.summary ?? '',
    files: result.state.data.files ?? {},
  }
}
