import { inngest } from '@/inngest/client';
import { prisma } from '@/lib/db';
import { protectedProcedure, createTRPCRouter } from '@/trpc/init';
import z from 'zod';
import { TRPCError } from '@trpc/server';
import { consumeCredits } from '@/lib/usage';

export const messageRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      return prisma.message.findMany({
        where: {
          projectId: input.projectId,
          project: { userId: ctx.auth.userId },
        },
        include: { fragment: true },
        orderBy: { updatedAt: 'asc' },
      });
    }),

  // ── Generate: full agent run — consumes a credit ──────────────────────────
  create: protectedProcedure
    .input(z.object({
      value: z.string().min(1).max(10000),
      projectId: z.string().min(1),
      imageUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const existingProject = await prisma.project.findFirst({
        where: {
          id: input.projectId,
          OR: [
            { userId: ctx.auth.userId },
            { workspace: { members: { some: { userId: ctx.auth.userId } } } },
          ],
        },
        include: { workspace: true },
      });
      if (!existingProject) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      // Check VIEWER cannot generate
      if (existingProject.workspaceId) {
        const member = await prisma.member.findUnique({
          where: { workspaceId_userId: { workspaceId: existingProject.workspaceId, userId: ctx.auth.userId } },
        });
        if (member?.role === 'VIEWER') throw new TRPCError({ code: 'FORBIDDEN', message: 'Viewers cannot generate code' });
      }

      const ownerUserId = existingProject.workspace?.ownerId;

      try {
        await consumeCredits(ownerUserId);
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Something went wrong' });
        } else {
          throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'You have run out of credits' });
        }
      }

      const createdMessage = await prisma.message.create({
        data: {
          projectId: existingProject.id,
          content: input.value,
          role: 'USER',
          type: 'RESULT',
          imageUrl: input.imageUrl ?? null,
          planStatus: 'pending',
        },
      })

      await inngest.send({
        name: 'code-agent/run',
        data: {
          value: input.value,
          projectId: input.projectId,
          messageId: createdMessage.id,
          imageUrl: input.imageUrl,
          supabaseUrl: existingProject.supabaseUrl,
          supabaseAnonKey: existingProject.supabaseAnonKey,
        },
      })

      return createdMessage
    }),

  // ── Approve plan — triggers code generation ────────────────────────────
  approvePlan: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const message = await prisma.message.findFirst({
        where: {
          id: input.messageId,
          project: {
            OR: [
              { userId: ctx.auth.userId },
              { workspace: { members: { some: { userId: ctx.auth.userId } } } },
            ],
          },
        },
        include: { project: { include: { workspace: true } } },
      })
      if (!message) throw new TRPCError({ code: 'NOT_FOUND' })
      if (message.planStatus !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Plan already actioned' })

      await prisma.message.update({
        where: { id: input.messageId },
        data: { planStatus: 'approved' },
      })

      await inngest.send({
        name: 'code-agent/run',
        data: {
          value: message.content,
          projectId: message.projectId,
          messageId: message.id,
          imageUrl: message.imageUrl ?? undefined,
          supabaseUrl: message.project.supabaseUrl ?? undefined,
          supabaseAnonKey: message.project.supabaseAnonKey ?? undefined,
        },
      })

      return { success: true }
    }),

  // ── Reject plan — refunds 1 credit ─────────────────────────────────────
  rejectPlan: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const message = await prisma.message.findFirst({
        where: {
          id: input.messageId,
          project: {
            OR: [
              { userId: ctx.auth.userId },
              { workspace: { members: { some: { userId: ctx.auth.userId } } } },
            ],
          },
        },
        include: { project: { include: { workspace: true } } },
      })
      if (!message) throw new TRPCError({ code: 'NOT_FOUND' })

      // Refund the credit — plan was rejected, no code was generated
      const chargeId = message.project.workspace?.ownerId ?? ctx.auth.userId
      await prisma.credits.update({
        where: { userId: chargeId },
        data: { balance: { increment: 1 } },
      })

      await prisma.message.update({
        where: { id: input.messageId },
        data: { planStatus: 'rejected' },
      })

      return { success: true }
    }),

  // ── Ask: free single-turn chat — NO credit consumed, NO code generation ───
  // Uses Gemini directly with the project's file context for Q&A, debugging,
  // explanations, and advice. Saves the exchange as messages for history.
  ask: protectedProcedure
    .input(z.object({
      value: z.string().min(1).max(5000),
      projectId: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const project = await prisma.project.findFirst({
        where: {
          id: input.projectId,
          OR: [
            { userId: ctx.auth.userId },
            { workspace: { members: { some: { userId: ctx.auth.userId } } } },
          ],
        },
        include: {
          messages: {
            where: { role: 'ASSISTANT', type: 'RESULT' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { fragment: true },
          },
        },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      // Save the user message
      await prisma.message.create({
        data: {
          projectId: input.projectId,
          content: input.value,
          role: 'USER',
          type: 'RESULT',
        },
      });

      // Build context from latest fragment files
      const latestFragment = project.messages[0]?.fragment;
      const filesContext = latestFragment?.files
        ? Object.entries(latestFragment.files as { [k: string]: string })
            .slice(0, 8) // cap to avoid huge context
            .map(([path, content]) => `\`\`\`${path}\n${content.slice(0, 2000)}\n\`\`\``)
            .join('\n\n')
        : 'No files generated yet.';

      // Call Gemini directly — no Inngest, no E2B, no credit consumed
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI not configured' });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{
                text: `You are a helpful assistant for a developer using an AI app builder called Isotope.
The user has a project with the following generated files. Answer their questions about the code,
explain how things work, suggest improvements, debug issues, or help them decide what to build next.
Be concise and practical. Do NOT generate new code unless specifically asked.

Current project files:
${filesContext}`,
              }],
            },
            contents: [{ role: 'user', parts: [{ text: input.value }] }],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
          }),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `AI error: ${err}` });
      }

      const data = await response.json();
      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sorry, I could not generate a response.';

      // Save AI reply — type RESULT so it shows as a normal assistant message
      // but without a fragment (no code was generated)
      const assistantMessage = await prisma.message.create({
        data: {
          projectId: input.projectId,
          content: replyText,
          role: 'ASSISTANT',
          type: 'RESULT',
        },
      });

      return assistantMessage;
    }),
  // ── Suggestions: generate 3 clickable next-step prompts after a generation ─
  // Called client-side after the assistant message appears.
  // Uses a cheap single-turn Gemini call — no credits consumed.
  getSuggestions: protectedProcedure
    .input(z.object({
      projectId: z.string().min(1),
      summary:   z.string().max(500),  // fragment title / assistant message
    }))
    .query(async ({ input, ctx }) => {
      // Verify user has access to this project
      const project = await prisma.project.findFirst({
        where: {
          id: input.projectId,
          OR: [
            { userId: ctx.auth.userId },
            { workspace: { members: { some: { userId: ctx.auth.userId } } } },
          ],
        },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });

      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) return { suggestions: [] };

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: {
                parts: [{
                  text: `You suggest follow-up prompts for an AI app builder.
Given a short description of what was just built, return EXACTLY 3 short follow-up prompts the user might want to do next.
Rules:
- Each prompt must be under 60 characters
- Start with an action verb (Add, Make, Create, Build, Connect, Show, Improve, Fix, Add, Turn)
- Be specific to what was described — not generic
- Return ONLY a JSON array of 3 strings — no explanation, no markdown, no code fences
Example output: ["Add user authentication", "Make it mobile responsive", "Add a dark mode toggle"]`,
                }],
              },
              contents: [{
                role: 'user',
                parts: [{ text: `What was just built: ${input.summary}` }],
              }],
              generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
            }),
          },
        );

        if (!res.ok) return { suggestions: [] };

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
        const clean = text.replace(/```json|```/g, '').trim();
        const suggestions = JSON.parse(clean);

        if (!Array.isArray(suggestions)) return { suggestions: [] };
        return { suggestions: suggestions.slice(0, 3).filter((s: any) => typeof s === 'string') };
      } catch {
        return { suggestions: [] };
      }
    }),
});
