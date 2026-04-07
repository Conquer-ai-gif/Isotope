import { prisma } from '@/lib/db'
import { protectedProcedure, createTRPCRouter } from '@/trpc/init'
import { getUsageStatus } from '@/lib/usage'

export const usageRouter = createTRPCRouter({
  status: protectedProcedure.query(async ({ ctx }) => {
    const status = await getUsageStatus(ctx.auth.userId)
    return {
      remainingPoints: status.balance,
      plan:            status.plan,
      nextReset:       status.nextReset,
    }
  }),

  // ── Per-user analytics — generation history, project stats ────────────────
  analytics: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId
    const now = new Date()
    const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startOf7Days  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)

    const [
      totalProjects,
      projects30Days,
      allFragments,
      fragments7Days,
      topProjects,
      dailyActivity,
    ] = await Promise.all([
      prisma.project.count({ where: { userId } }),

      prisma.project.count({ where: { userId, createdAt: { gte: startOf30Days } } }),

      prisma.fragment.count({
        where: { message: { project: { userId } } },
      }),

      prisma.fragment.count({
        where: {
          message: { project: { userId } },
          createAt: { gte: startOf7Days },
        },
      }),

      prisma.project.findMany({
        where: { userId },
        orderBy: { messages: { _count: 'desc' } },
        take: 5,
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          isPublic: true,
          vercelDeployUrl: true,
          _count: { select: { messages: true } },
        },
      }),

      prisma.fragment.findMany({
        where: {
          message: { project: { userId } },
          createAt: { gte: startOf30Days },
        },
        select: { createAt: true },
      }),
    ])

    // Build daily buckets
    const buckets: Record<string, number> = {}
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
      const key = d.toISOString().split('T')[0]
      buckets[key] = 0
    }
    for (const f of dailyActivity) {
      const key = f.createAt.toISOString().split('T')[0]
      if (buckets[key] !== undefined) buckets[key]++
    }

    const activityData = Object.entries(buckets).map(([date, count]) => ({ date, count }))
    const mostActiveDay = activityData.reduce(
      (max, d) => (d.count > max.count ? d : max),
      { date: '', count: 0 },
    )

    return {
      totalProjects,
      projects30Days,
      totalGenerations: allFragments,
      generations7Days: fragments7Days,
      topProjects,
      activityData,
      mostActiveDay,
    }
  }),
})
