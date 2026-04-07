// ══════════════════════════════════════════════════════════════════════════════
// OpenRouter — Model provider with free/paid tier support
// ══════════════════════════════════════════════════════════════════════════════
//
// FREE MODEL  : qwen/qwen3-coder        — free on OpenRouter, used by everyone now
// PAID MODEL  : anthropic/claude-sonnet-4-5 — enabled by a single env var switch
//
// HOW TO SWITCH PAID USERS TO CLAUDE (no code changes needed):
// ─────────────────────────────────────────────────────────────
// 1. Buy OpenRouter credits at https://openrouter.ai → Billing
// 2. In Vercel → Settings → Environment Variables, set:
//      PAID_USERS_GET_CLAUDE=true
// 3. Redeploy — paid users get Claude, free users stay on qwen
//
// To revert: set PAID_USERS_GET_CLAUDE=false in Vercel and redeploy.
//
// REQUIRED ENV VAR (always needed):
//      OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx
//
// ══════════════════════════════════════════════════════════════════════════════

// Free model — always used for free-tier users, never changes
const FREE_MODEL = 'qwen/qwen3-coder'

// Paid model — hardcoded to Claude Sonnet. Only activated when
// PAID_USERS_GET_CLAUDE=true is set in your environment variables.
const CLAUDE_MODEL = 'anthropic/claude-sonnet-4-5'

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
          'HTTP-Referer':  process.env.NEXT_PUBLIC_APP_URL ?? 'https://isotope.app',
          'X-Title':       'Isotope',
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
 *
 * - free       → qwen/qwen3-coder (always, no matter what)
 * - pro / team → Claude Sonnet IF PAID_USERS_GET_CLAUDE=true, otherwise qwen
 *
 * To activate Claude for paid users: set PAID_USERS_GET_CLAUDE=true in Vercel.
 * To go back to qwen for everyone: set PAID_USERS_GET_CLAUDE=false (or remove it).
 *
 * Usage: model: getOpenRouterModel(userPlan)
 */
export function getOpenRouterModel(plan: string) {
  const isPaid = plan === 'pro' || plan === 'team'
  const claudeEnabled = process.env.PAID_USERS_GET_CLAUDE === 'true'
  const modelSlug = isPaid && claudeEnabled ? CLAUDE_MODEL : FREE_MODEL
  return buildOpenRouterModel(modelSlug)
}

/**
 * Default model — always uses qwen (free).
 * Used for lightweight agents: title generation, response, architecture map.
 */
export const openRouterModel = buildOpenRouterModel(FREE_MODEL)
