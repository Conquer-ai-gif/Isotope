import { inngest } from '@/inngest/client';
import { prisma } from '@/lib/db';
import { protectedProcedure, baseProcedure, createTRPCRouter } from '@/trpc/init';
import z from 'zod';
import { TRPCError } from '@trpc/server';
import { generateSlug } from 'random-word-slugs';
import { consumeCredits } from '@/lib/usage';
import { getGitHubToken } from '@/lib/github-token';
import { getOctokit, pushFragmentToGitHub, registerGitHubWebhook, deleteGitHubWebhook } from '@/lib/github';
import { parseFigmaUrl, figmaToPrompt } from '@/lib/figma';
import { createSupabaseProject, deleteSupabaseProject, getSupabaseOrganizationId } from '@/lib/supabase-mgmt';

import { createVercelProject, deleteVercelProject, getLatestDeployUrl, addCustomDomain, removeCustomDomain, getDomainStatus } from '@/lib/vercel';
import crypto from 'crypto';

// ── Plan gate helper ──────────────────────────────────────────────────────────
async function requirePaidPlan(userId: string): Promise<void> {
  const { getUsageStatus } = await import('@/lib/usage')
  const status = await getUsageStatus(userId)
  if (status.plan === 'free') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This feature requires a Pro or Team plan. Upgrade at /pricing.',
    })
  }
}


export const projectsRouter = createTRPCRouter({

  // ── Core CRUD ──────────────────────────────────────────────────────────────
  getOne: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const project = await prisma.project.findFirst({
        where: {
          id: input.id,
          OR: [
            { userId: ctx.auth.userId },
            { workspace: { members: { some: { userId: ctx.auth.userId } } } },
          ],
        },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      return project;
    }),

  getMany: protectedProcedure.query(async ({ ctx }) => {
    return prisma.project.findMany({
      where: {
        OR: [
          { userId: ctx.auth.userId },
          { workspace: { members: { some: { userId: ctx.auth.userId } } } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }),

  create: protectedProcedure
    .input(z.object({
      value: z.string().min(1).max(10000),
      workspaceId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // If workspace project, find the owner to charge their credits
      let ownerUserId: string | undefined;
      if (input.workspaceId) {
        const workspace = await prisma.workspace.findUnique({
          where: { id: input.workspaceId },
          include: { members: { where: { userId: ctx.auth.userId } } },
        });
        if (!workspace) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
        if (!workspace.members.length) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member' });
        if (workspace.members[0].role === 'VIEWER') throw new TRPCError({ code: 'FORBIDDEN', message: 'Viewers cannot generate' });
        ownerUserId = workspace.ownerId;  // charge owner
      }
      try {
        await consumeCredits(ownerUserId);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Insufficient credits')) {
            throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'You have run out of credits' });
          }
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message || 'Failed to consume credits' });
        } else {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Something went wrong' });
        }
      }
      const createdProject = await prisma.project.create({
        data: {
          userId: ctx.auth.userId,
          workspaceId: input.workspaceId ?? null,
          name: generateSlug(2, { format: 'kebab' }),
          messages: { create: { content: input.value, role: 'USER', type: 'RESULT' } },
        },
      });
      await inngest.send({
        name: 'code-agent/run',
        data: { value: input.value, projectId: createdProject.id },
      });
      return createdProject;
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string().min(1), name: z.string().min(1).max(60) }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({ where: { id: input.id, userId: ctx.auth.userId } });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return prisma.project.update({ where: { id: input.id }, data: { name: input.name } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({ where: { id: input.id, userId: ctx.auth.userId } });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });

      // Clean up GitHub webhook
      if (project.repoOwner && project.repoName && project.repoWebhookId) {
        const githubToken = await getGitHubToken(ctx.auth.userId);
        if (githubToken) {
          await deleteGitHubWebhook({
            accessToken: githubToken.accessToken,
            owner: project.repoOwner,
            repo: project.repoName,
            hookId: project.repoWebhookId,
          }).catch((e) => {
            console.error(`Failed to delete GitHub webhook for project ${input.id}:`, e);
          });
        }
      }

      // Clean up Vercel project
      if (project.vercelProjectId) {
        await deleteVercelProject(project.vercelProjectId).catch((e) => {
          console.error(`Failed to delete Vercel project ${project.vercelProjectId} for project ${input.id}:`, e);
        });
      }

      await prisma.project.delete({ where: { id: input.id } });
      return { success: true };
    }),

  setPublic: protectedProcedure
    .input(z.object({ id: z.string().min(1), isPublic: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({ where: { id: input.id, userId: ctx.auth.userId } });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return prisma.project.update({ where: { id: input.id }, data: { isPublic: input.isPublic } });
    }),

  getPublic: baseProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.id, isPublic: true },
        include: {
          messages: {
            where: { role: 'ASSISTANT', type: 'RESULT' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { fragment: true },
          },
        },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found or not public' });
      return project;
    }),

  // ── Vercel: link project → GitHub repo → auto-deploy on every push ─────────
  // Called after bindRepo succeeds. Creates a Vercel project connected to the
  // GitHub repo — from this point every git push triggers a Vercel deployment.
  linkVercel: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId, userId: ctx.auth.userId },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!project.repoOwner || !project.repoName) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Bind a GitHub repo first before linking Vercel',
        });
      }
      if (!process.env.VERCEL_TOKEN) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'VERCEL_TOKEN is not configured on the server',
        });
      }

      // If already linked, just refresh the deploy URL
      if (project.vercelProjectId) {
        const deployUrl = await getLatestDeployUrl(project.vercelProjectId);
        if (deployUrl) {
          await prisma.project.update({
            where: { id: input.projectId },
            data: { vercelDeployUrl: deployUrl },
          });
        }
        return prisma.project.findUnique({ where: { id: input.projectId } });
      }

      const { projectId: vercelProjectId, deployUrl: vercelDeployUrl } = await createVercelProject({
        name: project.name,
        githubOwner: project.repoOwner,
        githubRepo: project.repoName,
      });

      return prisma.project.update({
        where: { id: input.projectId },
        data: { vercelProjectId, vercelDeployUrl },
      });
    }),

  // Refresh deploy URL — called after a new generation to show updated live URL
  refreshVercelUrl: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId, userId: ctx.auth.userId },
      });
      if (!project?.vercelProjectId) return null;

      const deployUrl = await getLatestDeployUrl(project.vercelProjectId);
      if (!deployUrl) return null;

      return prisma.project.update({
        where: { id: input.projectId },
        data: { vercelDeployUrl: deployUrl },
      });
    }),

  // Unlink Vercel — deletes the Vercel project
  unlinkVercel: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId, userId: ctx.auth.userId },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.vercelProjectId) {
        await deleteVercelProject(project.vercelProjectId).catch((e) => {
          console.error(`Failed to delete Vercel project ${project.vercelProjectId} during unlink for project ${input.projectId}:`, e);
        });
      }
      return prisma.project.update({
        where: { id: input.projectId },
        data: { vercelProjectId: null, vercelDeployUrl: null },
      });
    }),

  // ── GitHub two-way sync ────────────────────────────────────────────────────
  pushToGitHub: protectedProcedure
    .input(z.object({ fragmentId: z.string().min(1), repo: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const githubToken = await getGitHubToken(ctx.auth.userId);
      if (!githubToken) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Connect your GitHub account first' });
      const fragment = await prisma.fragment.findFirst({
        where: { id: input.fragmentId, message: { project: { userId: ctx.auth.userId } } },
      });
      if (!fragment) throw new TRPCError({ code: 'NOT_FOUND' });
      const { commitSha, branch } = await pushFragmentToGitHub({
        accessToken: githubToken.accessToken,
        owner: githubToken.login,
        repo: input.repo,
        files: fragment.files as { [path: string]: string },
        commitMessage: `feat: ${fragment.title} — synced from Isotope`,
      });
      return {
        commitSha, branch,
        url: `https://github.com/${githubToken.login}/${input.repo}/commit/${commitSha}`,
      };
    }),

  bindRepo: protectedProcedure
    .input(z.object({
      projectId: z.string().min(1),
      owner: z.string().min(1),
      repo: z.string().min(1),
      createRepo: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId, userId: ctx.auth.userId },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });

      const githubToken = await getGitHubToken(ctx.auth.userId);
      if (!githubToken) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Connect your GitHub account first' });

      const octokit = getOctokit(githubToken.accessToken);

      // Step 1 — optionally create the GitHub repo
      if (input.createRepo) {
        try {
          await octokit.repos.createForAuthenticatedUser({
            name: input.repo,
            private: true,
            auto_init: true,
            description: `Generated by Isotope — ${project.name}`,
          });
        } catch (e: any) {
          if (e.status !== 422) throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to create repo: ${e.message}` });
        }
      }

      // Step 2 — register GitHub webhook for inbound sync
      const webhookSecret = crypto.randomBytes(32).toString('hex');
      const hookId = await registerGitHubWebhook({
        accessToken: githubToken.accessToken,
        owner: input.owner,
        repo: input.repo,
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/github/webhook`,
        secret: webhookSecret,
      });

      // Step 3 — save GitHub binding
      await prisma.project.update({
        where: { id: input.projectId },
        data: {
          repoOwner: input.owner,
          repoName: input.repo,
          repoWebhookId: hookId,
          repoWebhookSecret: webhookSecret,
        },
      });

      // Step 4 — push existing fragment immediately so first build isn't lost
      const latestMessage = await prisma.message.findFirst({
        where: { projectId: input.projectId, role: 'ASSISTANT', type: 'RESULT' },
        orderBy: { createdAt: 'desc' },
        include: { fragment: true },
      });
      if (latestMessage?.fragment?.files) {
        try {
          await pushFragmentToGitHub({
            accessToken: githubToken.accessToken,
            owner: input.owner,
            repo: input.repo,
            files: latestMessage.fragment.files as { [path: string]: string },
            commitMessage: `feat: initial project — ${latestMessage.fragment.title}`,
          });
          await prisma.project.update({
            where: { id: input.projectId },
            data: { lastSyncedAt: new Date() },
          });
        } catch {}
      }

      // Step 5 — if VERCEL_TOKEN is configured, automatically link Vercel too
      let vercelProjectId: string | null = null;
      let vercelDeployUrl: string | null = null;

      if (process.env.VERCEL_TOKEN) {
        try {
          const result = await createVercelProject({
            name: project.name,
            githubOwner: input.owner,
            githubRepo: input.repo,
          });
          vercelProjectId = result.projectId;
          vercelDeployUrl = result.deployUrl;
        } catch (e) {
          // Don't fail the whole bind if Vercel setup fails
          console.error('Vercel link failed (non-fatal):', e);
        }
      }

      return prisma.project.update({
        where: { id: input.projectId },
        data: { vercelProjectId, vercelDeployUrl },
      });
    }),

  unbindRepo: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId, userId: ctx.auth.userId },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });

      // Remove GitHub webhook
      const githubToken = await getGitHubToken(ctx.auth.userId);
      if (githubToken && project.repoOwner && project.repoName && project.repoWebhookId) {
        await deleteGitHubWebhook({
          accessToken: githubToken.accessToken,
          owner: project.repoOwner,
          repo: project.repoName,
          hookId: project.repoWebhookId,
        }).catch((e) => {
          console.error(`Failed to delete GitHub webhook during unbind for project ${input.projectId}:`, e);
        });
      }

      // Remove Vercel project
      if (project.vercelProjectId) {
        await deleteVercelProject(project.vercelProjectId).catch((e) => {
          console.error(`Failed to delete Vercel project ${project.vercelProjectId} during unbind for project ${input.projectId}:`, e);
        });
      }

      return prisma.project.update({
        where: { id: input.projectId },
        data: {
          repoOwner: null, repoName: null,
          repoWebhookId: null, repoWebhookSecret: null,
          vercelProjectId: null, vercelDeployUrl: null,
        },
      });
    }),

  deprovisionSupabase: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({ where: { id: input.projectId, userId: ctx.auth.userId } });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.supabaseProjectId) {
        await deleteSupabaseProject(project.supabaseProjectId).catch((e) => {
          console.error(`Failed to delete Supabase project ${project.supabaseProjectId} for project ${input.projectId}:`, e);
        });
      }
      return prisma.project.update({
        where: { id: input.projectId },
        data: { supabaseProjectId: null, supabaseUrl: null, supabaseAnonKey: null },
      });
    }),

  getConflicts: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({ where: { id: input.projectId, userId: ctx.auth.userId } });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return prisma.syncConflict.findMany({
        where: { projectId: input.projectId, resolvedBy: null },
        orderBy: { createdAt: 'asc' },
      });
    }),

  resolveConflict: protectedProcedure
    .input(z.object({ id: z.string().min(1), resolvedBy: z.enum(['isotope', 'github']) }))
    .mutation(async ({ input, ctx }) => {
      const conflict = await prisma.syncConflict.findFirst({
        where: { id: input.id, project: { userId: ctx.auth.userId } },
        include: {
          project: {
            include: {
              messages: {
                where: { role: 'ASSISTANT', type: 'RESULT' },
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { fragment: true },
              },
            },
          },
        },
      });
      if (!conflict) throw new TRPCError({ code: 'NOT_FOUND' });

      const latestFragment = conflict.project.messages[0]?.fragment;
      if (latestFragment && input.resolvedBy === 'github') {
        const files = (latestFragment.files ?? {}) as { [path: string]: string };
        files[conflict.filePath] = conflict.githubContent;
        await prisma.fragment.update({ where: { id: latestFragment.id }, data: { files } });
      }

      return prisma.syncConflict.update({
        where: { id: input.id },
        data: { resolvedBy: input.resolvedBy },
      });
    }),
  // ── Supabase: provision a real database for the generated app ──────────────
  provisionSupabase: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId, userId: ctx.auth.userId },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      await requirePaidPlan(ctx.auth.userId);
      if (!process.env.SUPABASE_ACCESS_TOKEN) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'SUPABASE_ACCESS_TOKEN not configured' });
      }
      if (project.supabaseProjectId) {
        // Already provisioned — return existing credentials
        return { url: project.supabaseUrl!, anonKey: project.supabaseAnonKey! };
      }

      const orgId = await getSupabaseOrganizationId();
      const { id, url, anonKey } = await createSupabaseProject({
        name: project.name,
        organizationId: orgId,
      });

      await prisma.project.update({
        where: { id: input.projectId },
        data: { supabaseProjectId: id, supabaseUrl: url, supabaseAnonKey: anonKey },
      });

      return { url, anonKey };
    }),

  // ── Figma: import a design and generate a project from it ───────────────────
  importFromFigma: protectedProcedure
    .input(z.object({
      figmaUrl: z.string().url(),
      extraPrompt: z.string().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requirePaidPlan(ctx.auth.userId);
      if (!process.env.FIGMA_ACCESS_TOKEN) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'FIGMA_ACCESS_TOKEN is not configured on the server',
        });
      }

      // Consume credits first
      try {
        await consumeCredits();
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Something went wrong' });
        } else {
          throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'You have run out of credits' });
        }
      }

      // Use figmaToPrompt which handles everything: fetching, parsing, screenshot, description
      let figmaResult: { prompt: string; screenshotBase64: string | null; pageName: string };
      try {
        figmaResult = await figmaToPrompt(input.figmaUrl);
      } catch (e: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e.message ?? 'Failed to fetch Figma design. Make sure the file is accessible.',
        });
      }

      const extra = input.extraPrompt ? `\n\nAdditional instructions: ${input.extraPrompt}` : '';
      const fullPrompt = figmaResult.prompt + extra;

      const projectName = figmaResult.pageName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40) || generateSlug(2, { format: 'kebab' });

      const createdProject = await prisma.project.create({
        data: {
          userId: ctx.auth.userId,
          name: projectName,
          messages: {
            create: {
              content: fullPrompt,
              role: 'USER',
              type: 'RESULT',
              imageUrl: figmaResult.screenshotBase64,
            },
          },
        },
      });

      await inngest.send({
        name: 'code-agent/run',
        data: {
          value: fullPrompt,
          projectId: createdProject.id,
          imageUrl: figmaResult.screenshotBase64,
        },
      });

      return createdProject;
    }),

  // ── Figma: get frames from a file URL (for the picker) ──────────────────────

  // ── Figma: list frames (lightweight check before import) ────────────────────
  getFigmaFrames: protectedProcedure
    .input(z.object({ figmaUrl: z.string().url() }))
    .query(async ({ input }) => {
      const token = process.env.FIGMA_ACCESS_TOKEN;
      if (!token) return { frames: [], fileName: '' };

      const parsed = parseFigmaUrl(input.figmaUrl);
      if (!parsed) return { frames: [], fileName: '' };

      try {
        const { fetchFigmaNodes } = await import('@/lib/figma');
        const data = await fetchFigmaNodes(parsed.fileId);
        const fileName = data.name ?? data.document?.name ?? '';

        // Extract top-level frames from first page
        const pages = data.document?.children ?? [];
        const frames: { id: string; name: string }[] = [];
        for (const page of pages) {
          for (const child of page.children ?? []) {
            if (child.type === 'FRAME' || child.type === 'COMPONENT') {
              frames.push({ id: child.id, name: `${page.name} / ${child.name}` });
            }
          }
        }

        return {
          frames: frames.slice(0, 50),
          fileName,
          selectedNodeId: parsed.nodeId,
        };
      } catch {
        return { frames: [], fileName: '' };
      }
    }),

  // ── Save direct file edits back to the fragment ───────────────────────────
  saveFileEdits: protectedProcedure
    .input(z.object({
      fragmentId: z.string().min(1),
      files: z.record(z.string()),  // { [path]: content }
    }))
    .mutation(async ({ input, ctx }) => {
      const fragment = await prisma.fragment.findFirst({
        where: { id: input.fragmentId, message: { project: { userId: ctx.auth.userId } } },
      });
      if (!fragment) throw new TRPCError({ code: 'NOT_FOUND', message: 'Fragment not found' });

      const currentFiles = (fragment.files ?? {}) as { [path: string]: string };
      const updatedFiles = { ...currentFiles, ...input.files };

      return prisma.fragment.update({
        where: { id: input.fragmentId },
        data: { files: updatedFiles },
      });
    }),

  // ── Save project context document ─────────────────────────────────────────
  saveContext: protectedProcedure
    .input(z.object({
      projectId: z.string().min(1),
      contextDocument: z.string().max(8000),
    }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId, userId: ctx.auth.userId },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return prisma.project.update({
        where: { id: input.projectId },
        data: { contextDocument: input.contextDocument },
      });
    }),

  // ── Fork a public project into the current user's account ─────────────────
  fork: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      // Source must be public
      const source = await prisma.project.findUnique({
        where: { id: input.projectId, isPublic: true },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { fragment: true },
          },
        },
      });
      if (!source) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found or not public' });

      // Create the forked project
      const forked = await prisma.project.create({
        data: {
          userId: ctx.auth.userId,
          name: `${source.name}-fork`,
          isPublic: false,
        },
      });

      // Copy all messages + fragments
      for (const message of source.messages) {
        const newMessage = await prisma.message.create({
          data: {
            projectId: forked.id,
            content: message.content,
            role: message.role,
            type: message.type,
            imageUrl: message.imageUrl,
          },
        });

        if (message.fragment) {
          await prisma.fragment.create({
            data: {
              messageId: newMessage.id,
              sandboxUrl: message.fragment.sandboxUrl,
              title: message.fragment.title,
              files: message.fragment.files,
            },
          });
        }
      }

      return forked;
    }),

  // ── Custom domain: add to Vercel project ──────────────────────────────────
  addCustomDomain: protectedProcedure
    .input(z.object({
      projectId: z.string().min(1),
      domain: z.string().min(3).max(253).regex(
        /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
        'Please enter a valid domain name (e.g. myapp.com or app.myapp.com)'
      ),
    }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId, userId: ctx.auth.userId },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      await requirePaidPlan(ctx.auth.userId);
      if (!project.vercelProjectId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Connect Vercel first before adding a custom domain',
        });
      }

      let domainData: any;
      try {
        domainData = await addCustomDomain(project.vercelProjectId, input.domain);
      } catch (e: any) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
      }

      await prisma.project.update({
        where: { id: input.projectId },
        data: { customDomain: input.domain },
      });

      return domainData;
    }),

  // ── Custom domain: check verification status ───────────────────────────────
  checkDomainStatus: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId, userId: ctx.auth.userId },
      });
      if (!project?.vercelProjectId || !project.customDomain) return null;

      return getDomainStatus(project.vercelProjectId, project.customDomain);
    }),

  // ── Custom domain: remove ─────────────────────────────────────────────────
  removeCustomDomain: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId, userId: ctx.auth.userId },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });

      if (project.vercelProjectId && project.customDomain) {
        await removeCustomDomain(project.vercelProjectId, project.customDomain).catch((e) => {
          console.error(`Failed to remove custom domain ${project.customDomain} from Vercel project ${project.vercelProjectId} for project ${input.projectId}:`, e);
        });
      }

      return prisma.project.update({
        where: { id: input.projectId },
        data: { customDomain: null },
      });
    }),

  // ── Toggle "Built with Isotope" badge (Pro only) ─────────────────────────────
  toggleBadge: protectedProcedure
    .input(z.object({ projectId: z.string().min(1), hide: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId, userId: ctx.auth.userId },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return prisma.project.update({
        where: { id: input.projectId },
        data: { hideBadge: input.hide },
      });
    }),

  // ── Merge branch to main ───────────────────────────────────────────────
  mergeBranch: protectedProcedure
    .input(z.object({ fragmentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const fragment = await prisma.fragment.findFirst({
        where: {
          id: input.fragmentId,
          message: { project: { userId: ctx.auth.userId } },
        },
        include: { message: { include: { project: true } } },
      })
      if (!fragment) throw new TRPCError({ code: 'NOT_FOUND' })
      if (!fragment.branchName) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No branch for this fragment' })
      if (fragment.branchMerged) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already merged' })

      const project = fragment.message.project
      if (!project.repoOwner || !project.repoName) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No GitHub repo connected' })

      const { getGitHubToken } = await import('@/lib/github-token')
      const { mergeBranchToMain } = await import('@/lib/github')

      const token = await getGitHubToken(ctx.auth.userId)
      if (!token) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No GitHub token' })

      await mergeBranchToMain({
        accessToken: token.accessToken,
        owner: project.repoOwner,
        repo: project.repoName,
        branchName: fragment.branchName,
      })

      await prisma.fragment.update({
        where: { id: input.fragmentId },
        data: { branchMerged: true },
      })

      return { success: true }
    }),

  // ── Discard branch ────────────────────────────────────────────────────
  discardBranch: protectedProcedure
    .input(z.object({ fragmentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const fragment = await prisma.fragment.findFirst({
        where: {
          id: input.fragmentId,
          message: { project: { userId: ctx.auth.userId } },
        },
        include: { message: { include: { project: true } } },
      })
      if (!fragment) throw new TRPCError({ code: 'NOT_FOUND' })
      if (!fragment.branchName) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No branch for this fragment' })

      const project = fragment.message.project
      if (!project.repoOwner || !project.repoName) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No GitHub repo connected' })

      const { getGitHubToken } = await import('@/lib/github-token')
      const { deleteBranch } = await import('@/lib/github')

      const token = await getGitHubToken(ctx.auth.userId)
      if (!token) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No GitHub token' })

      await deleteBranch({
        accessToken: token.accessToken,
        owner: project.repoOwner,
        repo: project.repoName,
        branchName: fragment.branchName,
      })

      await prisma.fragment.update({
        where: { id: input.fragmentId },
        data: { branchName: null },
      })

      return { success: true }
    }),

});
