// ══════════════════════════════════════════════════════════════════════════════
// OpenRouter — Model provider with free/paid tier support
// ══════════════════════════════════════════════════════════════════════════════
//
// FREE MODEL  : qwen/qwen3-coder  — free on OpenRouter, used by all users now
// PAID MODEL  : set via OPENROUTER_PAID_MODEL env var (see production checklist)
//
// HOW TO SWITCH PAID USERS TO CLAUDE (no code changes needed):
// ─────────────────────────────────────────────────────────────
// 1. Go to https://openrouter.ai → top up your balance
// 2. In Vercel → Settings → Environment Variables, add:
//      OPENROUTER_PAID_MODEL=anthropic/claude-sonnet-4-5
// 3. Redeploy — paid users automatically get Claude, free users stay on qwen
//
// REQUIRED ENV VAR (always needed):
//      OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx
//
// ══════════════════════════════════════════════════════════════════════════════

// Free model — always used for free-tier users, never changes
const FREE_MODEL = 'qwen/qwen3-coder'

// Paid model — defaults to qwen until you set OPENROUTER_PAID_MODEL in Vercel
// When OPENROUTER_PAID_MODEL=anthropic/claude-sonnet-4-5 is set, paid users
// automatically get Claude Sonnet. Free users are never affected.
const PAID_MODEL = process.env.OPENROUTER_PAID_MODEL ?? 'qwen/qwen3-coder'

// ── Internal fetch helper ─────────────────────────────────────────────────────

function buildOpenRouterModel(modelSlug: string) {
  return {
    name: modelSlug,

    async run(messages: { role: string; content: string }[]): Promise<string> {
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not set. Add it to .env.local and Vercel environment variables.')
      }

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer':  process.env.NEXT_PUBLIC_APP_URL ?? 'https://luno.app',
          'X-Title':       'Luno',
        },
        body: JSON.stringify({
          model:       modelSlug,
          messages,
          max_tokens:  8192,
          temperature: 0.7,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`OpenRouter API error ${res.status}: ${err}`)
      }

      const data = await res.json()
      return data.choices?.[0]?.message?.content ?? ''
    },
  } as const
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the correct OpenRouter model based on the user's plan.
 * - free       → qwen/qwen3-coder (always free)
 * - pro / team → OPENROUTER_PAID_MODEL env var (defaults to qwen until set)
 *
 * Usage: model: getOpenRouterModel(userPlan)
 */
export function getOpenRouterModel(plan: string) {
  const isPaid = plan === 'pro' || plan === 'team'
  return buildOpenRouterModel(isPaid ? PAID_MODEL : FREE_MODEL)
}

/**
 * Default model — uses free tier (qwen).
 * Used for lightweight agents like title generation, response, architecture map.
 */
export const openRouterModel = buildOpenRouterModel(FREE_MODEL)
