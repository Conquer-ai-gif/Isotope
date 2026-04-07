import { Sandbox } from '@e2b/code-interpreter'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/db'
import { SANDBOX_TIMEOUT } from '@/inngest/types'

const TEMPLATE_ID = 'lune-vibe-3'

export interface SandboxManager {
  sandboxId: string
  sandbox: Sandbox
}

async function connectOrCreate(existingId: string | null): Promise<Sandbox> {
  if (existingId) {
    try {
      const sandbox = await Sandbox.connect(existingId)
      await sandbox.setTimeout(SANDBOX_TIMEOUT)
      return sandbox
    } catch {
      // Sandbox expired or unreachable — fall through to create
    }
  }

  const sandbox = await Sandbox.create(TEMPLATE_ID)
  await sandbox.setTimeout(SANDBOX_TIMEOUT)
  return sandbox
}

export async function getOrCreateSandbox(projectId: string): Promise<SandboxManager> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { sandboxId: true },
    })

    const sandbox = await connectOrCreate(project?.sandboxId ?? null)
    const sandboxId = sandbox.sandboxId

    if (project?.sandboxId !== sandboxId) {
      await prisma.project.update({
        where: { id: projectId },
        data: { sandboxId },
      })
    }

    return { sandboxId, sandbox }
  } catch (err) {
    Sentry.captureException(err, { extra: { context: 'getOrCreateSandbox', projectId } })
    throw err
  }
}

export async function getSandbox(sandboxId: string): Promise<Sandbox> {
  const sandbox = await Sandbox.connect(sandboxId)
  await sandbox.setTimeout(SANDBOX_TIMEOUT)
  return sandbox
}

export async function restoreFilesIntoSandbox(
  projectId: string,
  sandboxId: string,
): Promise<{ restoredCount: number }> {
  const lastFragment = await prisma.fragment.findFirst({
    where: { message: { projectId } },
    orderBy: { createAt: 'desc' },
  })

  if (!lastFragment?.files) return { restoredCount: 0 }

  const files = lastFragment.files as Record<string, string>
  const entries = Object.entries(files).filter(([, v]) => typeof v === 'string')

  const sandbox = await getSandbox(sandboxId)
  for (const [path, content] of entries) {
    await sandbox.files.write(path, content)
  }

  return { restoredCount: entries.length }
}
