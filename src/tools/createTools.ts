import { createTool } from '@inngest/agent-kit'
import * as Sentry from '@sentry/nextjs'
import z from 'zod'
import type { Tool } from '@inngest/agent-kit'
import { getSandbox } from '@/sandbox/sandboxManager'
import { makeEvent, type EventEmitterFn } from '@/streaming/events'

export interface AgentState {
  summary: string
  files: Record<string, string>
}

export interface ToolSet {
  terminal: ReturnType<typeof createTool>
  createOrUpdateFiles: ReturnType<typeof createTool>
  readFiles: ReturnType<typeof createTool>
}

export interface CreateToolsOptions {
  sandboxId: string
  allowedFiles?: string[]
  emit?: EventEmitterFn
}

export function createTools({ sandboxId, allowedFiles, emit }: CreateToolsOptions): ToolSet {
  const terminal = createTool({
    name: 'terminal',
    description: 'Run a shell command in the sandbox',
    parameters: z.object({ command: z.string() }),
    handler: async ({ command }, { step: toolStep }) => {
      return toolStep?.run('terminal', async () => {
        const buffers = { stdout: '', stderr: '' }
        try {
          const sandbox = await getSandbox(sandboxId)
          const result = await sandbox.commands.run(command, {
            onStdout: (data: string) => { buffers.stdout += data },
            onStderr: (data: string) => { buffers.stderr += data },
          })
          return result.stdout || '(no output)'
        } catch (err) {
          Sentry.captureException(err, {
            extra: { context: 'terminal tool', sandboxId, command: command.slice(0, 200) },
          })
          return `Command failed: ${err}\nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`
        }
      })
    },
  })

  const createOrUpdateFiles = createTool({
    name: 'createOrUpdateFiles',
    description: 'Create or update files in the sandbox',
    parameters: z.object({
      files: z.array(z.object({ path: z.string(), content: z.string() })),
    }),
    handler: async (
      { files },
      { step: toolStep, network }: Tool.Options<AgentState>,
    ) => {
      const violatingFiles = allowedFiles
        ? files.filter((f) => !allowedFiles.includes(f.path))
        : []

      if (violatingFiles.length > 0) {
        const msg = `Scope violation: agent tried to write files outside task scope: ${violatingFiles.map((f) => f.path).join(', ')}`
        Sentry.captureMessage(msg, { level: 'warning', extra: { sandboxId, allowedFiles } })
        const allowed = allowedFiles
          ? files.filter((f) => allowedFiles.includes(f.path))
          : files
        if (allowed.length === 0) return `Blocked: no allowed files to write`
        files = allowed
      }

      const newFiles = await toolStep?.run('createOrUpdateFiles', async () => {
        try {
          const updatedFiles: Record<string, string> = {
            ...(network?.state?.data?.files ?? {}),
          }
          const sandbox = await getSandbox(sandboxId)

          for (const file of files) {
            await sandbox.files.write(file.path, file.content)
            updatedFiles[file.path] = file.content
            emit?.(makeEvent('file_updated', { data: { path: file.path } }))
          }

          return updatedFiles
        } catch (err) {
          Sentry.captureException(err, { extra: { context: 'createOrUpdateFiles', sandboxId } })
          throw err
        }
      })

      if (newFiles && typeof newFiles === 'object' && network) {
        network.state.data.files = newFiles as Record<string, string>
      }
    },
  })

  const readFiles = createTool({
    name: 'readFiles',
    description: 'Read files from the sandbox',
    parameters: z.object({ files: z.array(z.string()) }),
    handler: async ({ files }, { step: toolStep }) => {
      return toolStep?.run('readFiles', async () => {
        try {
          const sandbox = await getSandbox(sandboxId)
          const contents: Array<{ path: string; content: string }> = []

          for (const file of files) {
            const content = await sandbox.files.read(file)
            contents.push({ path: file, content })
          }

          return JSON.stringify(contents)
        } catch (err) {
          Sentry.captureException(err, { extra: { context: 'readFiles', sandboxId } })
          throw err
        }
      })
    },
  })

  return { terminal, createOrUpdateFiles, readFiles }
}
