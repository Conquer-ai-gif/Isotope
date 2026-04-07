// ══════════════════════════════════════════════════════════════════════════════
// OpenRouter — Drop-in replacement for Gemini (or any model provider)
// ══════════════════════════════════════════════════════════════════════════════
//
// HOW TO ENABLE OPENROUTER
// ────────────────────────
// 1. Sign up at https://openrouter.ai and get your API key.
//
// 2. Add to your .env.local (and Vercel environment variables):
//      OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx
//
// 3. Uncomment the entire block below (select all, Cmd+/ or Ctrl+/).
//
// 4. In src/inngest/functions.ts, replace the model line:
//      BEFORE:  model: gemini({ model: 'gemini-2.0-flash' }),
//      AFTER:   model: openRouterModel,
//
//    And add this import at the top of functions.ts:
//      import { openRouterModel } from '@/lib/openrouter'
//
// 5. Run `npm install` — no extra packages needed (uses native fetch).
//
// AVAILABLE MODELS (examples — see https://openrouter.ai/models for full list)
// ─────────────────────────────────────────────────────────────────────────────
//   'anthropic/claude-sonnet-4-5'
//   'anthropic/claude-opus-4'
//   'openai/gpt-4o'
//   'openai/gpt-4o-mini'
//   'google/gemini-2.0-flash-001'        ← same model, different provider
//   'meta-llama/llama-3.1-405b-instruct'
//   'mistralai/mistral-large'
//   'deepseek/deepseek-coder'
//
// COST NOTE
// ─────────────────────────────────────────────────────────────────────────────
// OpenRouter bills per token via your OpenRouter balance.
// Each generation in Luno uses ~3–8k tokens.
// Monitor usage at https://openrouter.ai/activity
//
// ══════════════════════════════════════════════════════════════════════════════

// /*  ← REMOVE THIS LINE to uncomment the block

// import { createAgent } from '@inngest/agent-kit'

// // The model slug to use — swap this for any model on openrouter.ai/models
// const OPENROUTER_MODEL = 'anthropic/claude-sonnet-4-5'

// // Adapter that wraps OpenRouter's OpenAI-compatible API into the
// // shape @inngest/agent-kit's `model` field expects.
// export const openRouterModel = {
//   name: OPENROUTER_MODEL,

//   async run(messages: { role: string; content: string }[]): Promise<string> {
//     const apiKey = process.env.OPENROUTER_API_KEY
//     if (!apiKey) {
//       throw new Error('OPENROUTER_API_KEY is not set. Add it to .env.local and Vercel.')
//     }

//     const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
//       method: 'POST',
//       headers: {
//         'Content-Type':  'application/json',
//         'Authorization': `Bearer ${apiKey}`,
//         // Optional: identifies your app in the OpenRouter dashboard
//         'HTTP-Referer':  process.env.NEXT_PUBLIC_APP_URL ?? 'https://luno.app',
//         'X-Title':       'Luno',
//       },
//       body: JSON.stringify({
//         model:       OPENROUTER_MODEL,
//         messages,
//         max_tokens:  8192,
//         temperature: 0.7,
//       }),
//     })

//     if (!res.ok) {
//       const err = await res.text()
//       throw new Error(`OpenRouter API error ${res.status}: ${err}`)
//     }

//     const data = await res.json()
//     return data.choices?.[0]?.message?.content ?? ''
//   },
// } as const

// */  ← REMOVE THIS LINE to uncomment the block

// ── Placeholder export so the file is importable even when commented out ──────
// This lets you add `import { openRouterModel } from '@/lib/openrouter'`
// to functions.ts ahead of time without TypeScript errors.
// DELETE this line once you uncomment the real export above.
export const openRouterModel = null
