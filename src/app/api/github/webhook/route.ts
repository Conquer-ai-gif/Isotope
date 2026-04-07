import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getGitHubToken } from '@/lib/github-token';
import { getRepoFiles } from '@/lib/github';

function verifySignature(secret: string, body: string, sig: string) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

function diffFiles(
  luneeFiles: { [path: string]: string },
  githubFiles: { [path: string]: string },
) {
  const conflicts: { path: string; lunee: string; github: string }[] = [];
  const toUpdate: { [path: string]: string } = {};

  for (const [path, githubContent] of Object.entries(githubFiles)) {
    const luneeContent = luneeFiles[path];
    if (!luneeContent) {
      toUpdate[path] = githubContent;
    } else if (luneeContent !== githubContent) {
      conflicts.push({ path, lunee: luneeContent, github: githubContent });
    }
  }
  return { toUpdate, conflicts };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('x-hub-signature-256') ?? '';
  const githubEvent = req.headers.get('x-github-event');

  if (githubEvent !== 'push') return new Response('Ignored', { status: 200 });

  const payload = JSON.parse(body);
  const repoOwner = payload.repository?.owner?.login;
  const repoName = payload.repository?.name;

  if (!repoOwner || !repoName) return new Response('Bad payload', { status: 400 });

  const project = await prisma.project.findFirst({
    where: { repoOwner, repoName },
    include: {
      messages: {
        where: { role: 'ASSISTANT', type: 'RESULT' },
        orderBy: { createAt: 'desc' },
        take: 1,
        include: { fragment: true },
      },
    },
  });

  if (!project) return new Response('No bound project', { status: 200 });

  // Verify per-project webhook secret
  const secret = project.repoWebhookSecret;
  if (!secret || !verifySignature(secret, body, sig)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const githubToken = await getGitHubToken(project.userId);
  if (!githubToken) return new Response('No token', { status: 200 });

  // Only fetch changed files from the push payload (avoids rate limit issues)
  const changedPaths = new Set<string>();
  for (const commit of payload.commits ?? []) {
    [...(commit.added ?? []), ...(commit.modified ?? [])].forEach((p: string) => changedPaths.add(p));
  }

  let githubFiles: { [path: string]: string } = {};
  if (changedPaths.size > 0) {
    try {
      const all = await getRepoFiles({ accessToken: githubToken.accessToken, owner: repoOwner, repo: repoName });
      for (const p of changedPaths) {
        if (all[p] !== undefined) githubFiles[p] = all[p];
      }
    } catch {
      return new Response('Failed to fetch files', { status: 500 });
    }
  }

  const latestFragment = project.messages[0]?.fragment;
  const luneeFiles = (latestFragment?.files ?? {}) as { [path: string]: string };
  const { toUpdate, conflicts } = diffFiles(luneeFiles, githubFiles);

  if (conflicts.length > 0) {
    await prisma.syncConflict.createMany({
      data: conflicts.map((c) => ({
        projectId: project.id,
        filePath: c.path,
        luneeContent: c.lunee,
        githubContent: c.github,
      })),
      skipDuplicates: true,
    });
  }

  if (latestFragment && Object.keys(toUpdate).length > 0) {
    await prisma.fragment.update({
      where: { id: latestFragment.id },
      data: { files: { ...luneeFiles, ...toUpdate } },
    });
  }

  await prisma.project.update({ where: { id: project.id }, data: { lastSyncedAt: new Date() } });

  return new Response('OK', { status: 200 });
}
