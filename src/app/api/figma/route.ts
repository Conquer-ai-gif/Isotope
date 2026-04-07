import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { figmaToPrompt, parseFigmaUrl } from '@/lib/figma';
import { prisma } from '@/lib/db';
import { inngest } from '@/inngest/client';
import { generateSlug } from 'random-word-slugs';
import { consumeCredits } from '@/lib/usage';
import { TRPCError } from '@trpc/server';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { figmaUrl } = await req.json();

  if (!figmaUrl || typeof figmaUrl !== 'string') {
    return Response.json({ error: 'figmaUrl is required' }, { status: 400 });
  }

  if (!parseFigmaUrl(figmaUrl)) {
    return Response.json({ error: 'Invalid Figma URL. Paste a link from figma.com/file/... or figma.com/design/...' }, { status: 400 });
  }

  if (!process.env.FIGMA_ACCESS_TOKEN) {
    return Response.json({ error: 'FIGMA_ACCESS_TOKEN not configured on server' }, { status: 500 });
  }

  // Consume a credit
  try {
    await consumeCredits();
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: 'Something went wrong' }, { status: 400 });
    }
    return Response.json({ error: 'You have run out of credits' }, { status: 429 });
  }

  // Fetch and convert the Figma design
  let prompt: string;
  let screenshotBase64: string | null;
  let pageName: string;

  try {
    ({ prompt, screenshotBase64, pageName } = await figmaToPrompt(figmaUrl));
  } catch (e: any) {
    return Response.json({ error: e.message ?? 'Failed to fetch Figma design' }, { status: 400 });
  }

  // Create the project with the design name
  const project = await prisma.project.create({
    data: {
      userId,
      name: generateSlug(2, { format: 'kebab' }),
      messages: {
        create: {
          content: `Import Figma design: ${pageName} (${figmaUrl})`,
          role: 'USER',
          type: 'RESULT',
          imageUrl: screenshotBase64,
        },
      },
    },
  });

  // Fire the Inngest agent with the full design prompt + screenshot
  await inngest.send({
    name: 'code-agent/run',
    data: {
      value: prompt,
      projectId: project.id,
      imageUrl: screenshotBase64,
      figmaUrl,
    },
  });

  return Response.json({ projectId: project.id, pageName });
}
