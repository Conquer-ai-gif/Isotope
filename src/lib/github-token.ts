import { prisma } from '@/lib/db';

export async function saveGitHubToken({ userId, accessToken, login }: {
  userId: string; accessToken: string; login: string;
}) {
  return prisma.gitHubToken.upsert({
    where: { userId },
    update: { accessToken, login },
    create: { userId, accessToken, login },
  });
}

export async function getGitHubToken(userId: string) {
  return prisma.gitHubToken.findUnique({ where: { userId } });
}
