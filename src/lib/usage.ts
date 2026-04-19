import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import type { Plan, CreditEventReason } from '@/generated/prisma'

// ── Plan limits ───────────────────────────────────────────────────────────────
export const PLAN_CREDITS: Record<Plan, number> = {
  free: 5,
  pro:  100,
  team: 300,
}

const REFERRAL_BONUS  = 5
const GENERATION_COST = 1

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

async function logEvent(
  userId: string,
  delta: number,
  reason: CreditEventReason,
): Promise<void> {
  await prisma.creditEvent.create({ data: { userId, delta, reason } })
}

// ── Initialise credits for a brand-new user (called on user.created webhook) ──
export async function initCredits(userId: string): Promise<void> {
  const now = new Date()
  const nextReset = addDays(now, 30)

  await prisma.credits.upsert({
    where:  { userId },
    update: {},
    create: {
      userId,
      balance:   PLAN_CREDITS.free,
      plan:      'free',
      lastReset: now,
      nextReset,
    },
  })

  await logEvent(userId, PLAN_CREDITS.free, 'signup')
}

// ── Consume 1 credit for a generation ────────────────────────────────────────
export async function consumeCredits(ownerUserId?: string): Promise<void> {
  const { userId: actorId } = await auth()
  if (!actorId) throw new Error('User not authenticated')

  const chargeId = ownerUserId ?? actorId

  let credits = await prisma.credits.findUnique({ where: { userId: chargeId } })
  
  // If credits record doesn't exist, initialize it (handles race condition with webhook)
  if (!credits) {
    await initCredits(chargeId)
    credits = await prisma.credits.findUnique({ where: { userId: chargeId } })
    if (!credits) throw new Error('Failed to initialize credits')
  }
  
  if (credits.balance < GENERATION_COST) throw new Error('Insufficient credits')

  await prisma.credits.update({
    where: { userId: chargeId },
    data:  { balance: { decrement: GENERATION_COST } },
  })

  await logEvent(chargeId, -GENERATION_COST, 'generation')
}

// ── Get current credit status for the UI ─────────────────────────────────────
export async function getUsageStatus(userId?: string) {
  const uid = userId ?? (await auth()).userId
  if (!uid) throw new Error('User not authenticated')

  const credits = await prisma.credits.findUnique({ where: { userId: uid } })
  if (!credits) return { balance: 0, plan: 'free' as Plan, nextReset: new Date() }

  return {
    balance:   Math.max(0, credits.balance),
    plan:      credits.plan,
    nextReset: credits.nextReset,
  }
}

// ── Apply a plan change (upgrade or renewal) ─────────────────────────────────
export async function applyPlanChange(
  userId: string,
  newPlan: Plan,
  reason: Extract<CreditEventReason, 'plan_upgrade' | 'plan_renewal'>,
): Promise<void> {
  const now        = new Date()
  const nextReset  = addDays(now, 30)
  const newBalance = PLAN_CREDITS[newPlan]

  await prisma.credits.upsert({
    where:  { userId },
    update: { plan: newPlan, balance: newBalance, lastReset: now, nextReset },
    create: { userId, plan: newPlan, balance: newBalance, lastReset: now, nextReset },
  })

  await logEvent(userId, newBalance, reason)
}

// ── Daily free-tier top-up (called by Inngest cron every midnight UTC) ──────
// Tops up every free user whose balance is BELOW 5 to exactly 5.
// If balance is already 5 — leave it untouched. Never exceeds 5.
// Pro and Team plans are NOT affected — they reset monthly on billing date.
export async function resetFreeCredits(): Promise<number> {
  const now = new Date()

  const due = await prisma.credits.findMany({
    where: {
      plan:    'free',
      balance: { lt: PLAN_CREDITS.free },
    },
    select: { userId: true, balance: true },
  })

  if (due.length === 0) return 0

  await Promise.all(
    due.map(async ({ userId, balance }) => {
      const delta = PLAN_CREDITS.free - balance  // e.g. had 3 → +2 to reach 5
      await prisma.credits.update({
        where: { userId },
        data:  { balance: PLAN_CREDITS.free, lastReset: now },
      })
      await logEvent(userId, delta, 'monthly_reset')
    }),
  )

  return due.length
}

// ── Referral helpers ──────────────────────────────────────────────────────────

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await prisma.referral.findUnique({ where: { ownerId: userId } })
  if (existing) return existing.code

  const code = Math.random().toString(36).slice(2, 10)
  const referral = await prisma.referral.create({
    data: { code, ownerId: userId },
  })
  return referral.code
}

export async function applyReferralCode(
  newUserId: string,
  code: string,
): Promise<{ success: boolean; message: string }> {
  const referral = await prisma.referral.findUnique({
    where: { code: code.toLowerCase().trim() },
  })

  if (!referral)
    return { success: false, message: 'Invalid referral code' }
  if (referral.ownerId === newUserId)
    return { success: false, message: 'Cannot use your own referral code' }

  const alreadyUsed = await prisma.referralUse.findUnique({ where: { newUserId } })
  if (alreadyUsed)
    return { success: false, message: 'You have already used a referral code' }

  await prisma.referralUse.create({
    data: { referralId: referral.id, newUserId },
  })

  await prisma.credits.updateMany({
    where: { userId: { in: [referral.ownerId, newUserId] } },
    data:  { balance: { increment: REFERRAL_BONUS } },
  })

  await logEvent(referral.ownerId, REFERRAL_BONUS, 'referral')
  await logEvent(newUserId,        REFERRAL_BONUS, 'referral')

  return {
    success: true,
    message: `${REFERRAL_BONUS} bonus credits added to both accounts`,
  }
}
