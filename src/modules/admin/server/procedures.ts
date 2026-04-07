import { prisma } from '@/lib/db'
import { clerkClient } from '@clerk/nextjs/server'
import { baseProcedure, createTRPCRouter } from '@/trpc/init'
import { z } from 'zod'

// All admin procedures use baseProcedure — access control is handled
// entirely at the middleware level (ADMIN_USER_IDS env var).
// No userId check needed here since only admins reach this router.

export const adminRouter = createTRPCRouter({

  // ── Overview stats ─────────────────────────────────────────────────────────
  stats: baseProcedure.query(async () => {
    const now = new Date()
    const startOfToday  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOf7Days  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
    const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalUsersRaw,
      totalProjects,
      totalMessages,
      totalFragments,
      projectsToday,
      projects7Days,
      projects30Days,
      successfulGenerations7Days,
      recentProjects,
    ] = await Promise.all([
      prisma.project.groupBy({ by: ['userId'] }),
      prisma.project.count(),
      prisma.message.count(),
      prisma.fragment.count(),
      prisma.project.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.project.count({ where: { createdAt: { gte: startOf7Days } } }),
      prisma.project.count({ where: { createdAt: { gte: startOf30Days } } }),
      prisma.message.count({
        where: {
          role: 'ASSISTANT',
          type: 'RESULT',
          fragment: { isNot: null },
          createAt: { gte: startOf7Days },
        },
      }),
      prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          userId: true,
          createdAt: true,
          isPublic: true,
          vercelDeployUrl: true,
          _count: { select: { messages: true } },
        },
      }),
    ])

    return {
      totalUsers: totalUsersRaw.length,
      totalProjects,
      totalMessages,
      totalFragments,
      projectsToday,
      projects7Days,
      projects30Days,
      successfulGenerations7Days,
      recentProjects,
    }
  }),

  // ── Daily activity chart ───────────────────────────────────────────────────
  dailyActivity: baseProcedure
    .input(z.object({ days: z.number().min(7).max(90).default(30) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000)

      const [projects, fragments] = await Promise.all([
        prisma.project.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        prisma.fragment.findMany({
          where: { createAt: { gte: since } },
          select: { createAt: true },
        }),
      ])

      const buckets: Record<string, { date: string; projects: number; generations: number }> = {}
      for (let i = 0; i < input.days; i++) {
        const d = new Date(Date.now() - (input.days - 1 - i) * 24 * 60 * 60 * 1000)
        const key = d.toISOString().split('T')[0]
        buckets[key] = { date: key, projects: 0, generations: 0 }
      }
      for (const p of projects) {
        const key = p.createdAt.toISOString().split('T')[0]
        if (buckets[key]) buckets[key].projects++
      }
      for (const f of fragments) {
        const key = f.createAt.toISOString().split('T')[0]
        if (buckets[key]) buckets[key].generations++
      }
      return Object.values(buckets)
    }),

  // ── Users table ────────────────────────────────────────────────────────────
  users: baseProcedure
    .input(z.object({
      page:  z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.limit

      const userStats = await prisma.project.groupBy({
        by: ['userId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        skip: offset,
        take: input.limit,
      })

      const userIds = userStats.map((u) => u.userId)

      const [latestProjects, genCounts, projectsByUser, totalUsersRaw] = await Promise.all([
        prisma.project.findMany({
          where: { userId: { in: userIds } },
          orderBy: { createdAt: 'desc' },
          select: { userId: true, createdAt: true, name: true },
        }),
        prisma.message.groupBy({
          by: ['projectId'],
          where: {
            role: 'ASSISTANT',
            type: 'RESULT',
            fragment: { isNot: null },
            project: { userId: { in: userIds } },
          },
          _count: { id: true },
        }),
        prisma.project.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, id: true },
        }),
        prisma.project.groupBy({ by: ['userId'] }),
      ])

      const latestByUser = latestProjects.reduce((acc, p) => {
        if (!acc[p.userId]) acc[p.userId] = p
        return acc
      }, {} as Record<string, typeof latestProjects[0]>)

      const projectIdToUser = projectsByUser.reduce((acc, p) => {
        acc[p.id] = p.userId
        return acc
      }, {} as Record<string, string>)

      const gensByUser = genCounts.reduce((acc, g) => {
        const uid = projectIdToUser[g.projectId]
        if (uid) acc[uid] = (acc[uid] ?? 0) + g._count.id
        return acc
      }, {} as Record<string, number>)

      // Batch fetch user names from Clerk
      let clerkUsers: Record<string, { name: string; email: string }> = {}
      try {
        const client = await clerkClient()
        const users = await client.users.getUserList({
          userId: userIds,
          limit: input.limit,
        })
        for (const u of users.data) {
          const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || 'Unknown'
          const email = u.emailAddresses[0]?.emailAddress ?? ''
          clerkUsers[u.id] = { name, email }
        }
      } catch { /* graceful fallback — show IDs if Clerk call fails */ }

      return {
        users: userStats.map((u) => ({
          userId:          u.userId,
          name:            clerkUsers[u.userId]?.name ?? u.userId.slice(-8),
          email:           clerkUsers[u.userId]?.email ?? '',
          projectCount:    u._count.id,
          generationCount: gensByUser[u.userId] ?? 0,
          lastActive:      latestByUser[u.userId]?.createdAt ?? null,
          lastProjectName: latestByUser[u.userId]?.name ?? null,
        })),
        total:      totalUsersRaw.length,
        page:       input.page,
        totalPages: Math.ceil(totalUsersRaw.length / input.limit),
      }
    }),

  // ── Top projects ───────────────────────────────────────────────────────────
  topProjects: baseProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      return prisma.project.findMany({
        take: input.limit,
        select: {
          id: true,
          name: true,
          userId: true,
          isPublic: true,
          createdAt: true,
          vercelDeployUrl: true,
          _count: { select: { messages: true } },
        },
        orderBy: { messages: { _count: 'desc' } },
      })
    }),
})
