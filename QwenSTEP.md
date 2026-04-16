omplete Recap: Everything We've Built Together

Here is the **full summary** of our conversation, organized by topic, with all decisions, prompts, and architecture locked in for your team.

---

## 🎯 1. Original Goal
> *"I don't like the look of my UI. I want a prompt to give my coding agent to update it."*

**What we delivered:**
✅ A production-ready Vercel-style dark theme system using semantic tokens, HSL values, and strict 80/15/5 hierarchy rules.

---

## 🎨 2. Design System Decisions

### Theme Choice: Vercel Dark (Not PayPal)
| Reason | Why Vercel Wins |
|--------|----------------|
| Audience | Developers, engineers, technical founders |
| Brand Fit | Matches your stack (Next.js, Vercel Deploy, E2B, Inngest) |
| Psychology | "Serious tooling for builders" vs. "Safe checkout for payments" |
| Your Goal | "Calm, high-trust, infrastructure-grade" |

### Strict Color Mapping (HSL for Shadcn)
```css
--background: 210 10% 4%;      /* #0B0F14 */
--card: 210 8% 6%;             /* #0F141A */
--muted: 215 16% 12%;          /* #111827 */
--border: 215 16% 20%;         /* #1F2937 */
--foreground: 210 20% 93%;     /* #E5E7EB */
--muted-foreground: 215 13% 69%;/* #9CA3AF */
--primary/--ring: 217 91% 60%; /* #3B82F6 */
```

### UI Rules (Non-Negotiable)
- Semantic tokens only: `bg-background`, `text-foreground`, `border-border`
- Single accent: `#3B82F6` for primary buttons, links, focus rings only
- No hardcoded hex, no bright gradients, no competing colors
- Content-first layout: preview/code dominates, UI chrome recedes
- WCAG AA contrast, keyboard accessible, mobile responsive

---

## 🤖 3. AI Planning & Execution Architecture

### Planner Prompt (`TASK_GRAPH_PLAN_PROMPT`) — Enlarged
**Added:**
- Strict JSON output schema with `tasks`, `riskFlags`, `nextStep`
- Scope management: MVP-first, hard limits (max 8 tasks, 3 tables, 4 routes)
- Phasing order: DB → Backend → Integration → UI
- Anti-patterns: no placeholder UI, no empty routes, no platform/app logic mixing
- Iteration handoff: `nextStep` provides exact prompt for next cycle

### Execution Model: DAG (Dependency-Driven)
- `TaskExecutor` resolves `dependsOn` arrays to build execution graph
- Parallel where dependencies are met, sequential where chained
- Per-task TypeScript validation → auto-fix agent on failure
- E2B sandbox persists across tasks; files restored from last fragment

### Backend Orchestration (`function.ts`) — Confirmed Working
- Planning phase: generates task graph, saves to `Message.plan`, returns `awaiting_approval`
- Approval gate: checks `planStatus`, skips planning if `approved`, runs `TaskExecutor`
- Post-execution: architecture map, vector store, GitHub push, Vercel URL refresh

---

## 🖥️ 4. Frontend UI Components — Prompts Created

### Plan Approval Component
- **Trigger:** `message.planStatus === 'pending'`
- **Behavior:** Renders task list, risk flags (warning section), Approve/Reject buttons
- **State:** Loading states, optimistic updates, polling for status changes
- **Design:** Semantic Tailwind, Vercel dark theme, keyboard accessible, mobile responsive
- **Action:** Calls approval mutation → updates DB → triggers Inngest → UI transitions

### Next Step Suggestion Chip
- **Trigger:** `message.type === 'RESULT'` && valid `nextStep` in `message.plan`
- **Behavior:** Cleans text (removes prefixes/quotes), renders as subtle clickable chip
- **Action:** Auto-fills chat input on click, shifts focus, does NOT auto-submit
- **Design:** `bg-muted/50`, `border-border`, `text-muted-foreground`, hover/focus states aligned
- **Edge Cases:** Silently hides if parsing fails, no layout shift, mobile-safe tap targets

### Approval Trigger Mutation
- **Endpoint:** tRPC mutation or `/api/plan-status`
- **Payload:** `{ messageId, action: 'approve' | 'reject' }`
- **Approve Path:** Updates `planStatus: approved` → emits `code-agent/run` → Inngest resumes
- **Reject Path:** Updates `planStatus: rejected` → clears UI → chat remains interactive
- **Security:** Input validation, Sentry error logging, no double-submission

---

## 🔐 5. Secure API Key & Integration System

### 5-Layer Architecture
| Layer | Responsibility |
|-------|----------------|
| **Database** | Store keys per-project (nullable strings in `Project` model) |
| **Platform UI** | `/project/[id]/settings/integrations` with masked inputs, format validation |
| **Backend Injection** | Fetch all keys → format to `.env.local` string → single `sandbox.files.write()` |
| **AI Enforcement** | Strict `process.env.*` rules, no hardcoded secrets, mock fallbacks |
| **Fallback/Mock** | Stub implementations + UI banners when keys missing |

### Key Handling Rules
- **NEVER** pass keys to AI prompts, frontend state, or Inngest payloads
- **ALWAYS** inject via single `.env.local` file (scales to 100+ keys without code changes)
- Next.js auto-loads `.env.local` → zero custom runtime parsing
- Missing keys → graceful mock + non-blocking setup prompt
- Platform UI masks keys by default, reveals on explicit toggle

### Guided Setup Flow (Generated App)
1. AI generates code with `process.env.VARIABLE_NAME`
2. If missing, renders: `🔑 [Service] key required` banner + "Setup" button
3. Button opens modal: masked input + save action
4. Modal calls platform API → key saved encrypted → preview reloads
5. OAuth supported? Show "Connect" button. Else: "Paste Key" flow only

---

## 📜 6. Prompt Architecture (`prompt.ts`) — Final State

### Core Prompts
| Prompt | Purpose | Key Constraints |
|--------|---------|-----------------|
| `TASK_GRAPH_PLAN_PROMPT` | Generates execution plan JSON | Strict schema, scope limits, MVP-first, `riskFlags`/`nextStep` output |
| `PROMPT` | Main coding agent | 5-step workflow, anti-overengineering, dynamic package installs, `` output |
| `BACKEND_AGENT_PROMPT` | API/backend logic | Zod validation, proper HTTP codes, Prisma/Supabase patterns, error handling |
| `DESIGN_LIBRARY` | UI component rules | Semantic tokens only, Shadcn imports, no hardcoded colors, 80/15/5 rule |

### Mandatory Output Format
All coding agents must finish with:
```xml

[High-level summary of what was built/changed]

```
- Printed once at the very end
- Never wrapped in backticks
- Parsed by `parseAgentOutput` for response generation & title creation

---

## 🗄️ 7. Data Mode

ndatory Output Format
All coding agents must finish with:
```xml

[High-level summary of what was built/changed]

```
- Printed once at the very end
- Never wrapped in backticks
- Parsed by `parseAgentOutput` for response generation & title creation

---

## 🗄️ 7. Data Models (Prisma) — Confirmed Ready

### `Message`
- `plan`: `String?` (JSON string of task graph with `tasks`, `riskFlags`, `nextStep`)
- `planStatus`: `PlanStatus?` (`pending | approved | rejected`)
- `type`: `MessageType` (`RESULT | ERROR`)
- `fragment`: Relation to generated files, sandbox URL, branch name

### `Project`
- `sandboxId`: `String?` (Persistent E2B sandbox)
- `contextDocument`: `String?` (Architecture map injected into prompts)
- Integration fields: `resendApiKey`, `supabaseUrl`, `supabaseAnonKey`, `stripeSecretKey`, etc.

### `Fragment`
- `files`: `Json` (Snapshot of generated codebase)
- `branchName`: `String?` (Git branch per generation)
- `sandboxUrl` / `deployUrl`: `String` (Preview & production links)

---

## 📦 8. Deliverables Summary (Copy-Paste Ready)

| Deliverable | Status | Location |
|-------------|--------|----------|
| Vercel Dark Theme CSS Variables | ✅ Ready | `app/globals.css` |
| Enlarged `TASK_GRAPH_PLAN_PROMPT` | ✅ Ready | `src/prompt.ts` |
| Secure Env Handling Rules | ✅ Ready | `PROMPT` + `BACKEND_AGENT_PROMPT` |
| Plan Approval UI Prompt | ✅ Ready | Instruction-only, zero code |
| Next Step Chip Prompt | ✅ Ready | Instruction-only, zero code |
| Approval Mutation Prompt | ✅ Ready | Instruction-only, zero code |
| Secure Integration System Prompt | ✅ Ready | 5-layer architecture, `.env.local` injection |
| Architecture Reference Doc | ✅ Ready | `.md` format for team review |
| Phased Implementation Order | ✅ Ready | Foundation → Backend → Frontend → Integrations → E2E |

---

## 🚀 9. Implementation Order (Dependency-Aware)

```
PHASE 1: Foundation
├─ Update Prisma schema (integration fields)
├─ Update TASK_GRAPH_PLAN_PROMPT (scope limits, riskFlags, nextStep)
├─ Update PROMPT + BACKEND_AGENT_PROMPT (secure env rules)
└─ Verify: npx tsc passes, test prompt outputs valid JSON

PHASE 2: Backend Orchestration
├─ Build approval trigger mutation (tRPC/API)
├─ Update function.ts for .env.local sandbox injection
├─ Verify DAG execution with dependsOn
└─ Verify: approve → execution starts, .env.local exists in sandbox

PHASE 3: Frontend UI
├─ Build Plan Approval component (pending state)
├─ Build Next Step chip (RESULT state)
├─ Integrate into chat layout
└─ Verify: approve/reject flow works, chip auto-fills input

PHASE 4: Secure Integrations
├─ Build platform Integrations settings page
├─ Verify AI generates guided setup UI when keys missing
├─ Wire platform key-save API
└─ Verify: missing key → mock + banner → paste → real API works

PHASE 5: End-to-End Testing
├─ Run full MVP test: "Build n8n clone"
├─ Test failure paths: reject, malformed JSON, timeout, missing keys
├─ Audit security: zero secret leakage, credit timing, mobile responsiveness
└─ Sign-off: all checklists pass
```

---

## ✅ 10. What's NOT Included (Intentionally)
- ❌ No implementation code in prompts (instruction-only for your agent)
- ❌ No changes to `parseAgentOutput` (confirmed safe as-is)
- ❌ No individual `env.set()` calls per key (scalable `.env.local` pattern only)
- ❌ No hardcoded colors in components (semantic tokens enforced)
- ❌ No auto-fetching of API keys by AI (guided user flow only)

---

## 📝 How to Use This Recap
1. **Team Onboarding:** Share this doc as the single source of truth
2. **Code Reviews:** Reference UI rules, prompt constraints, data flow during PRs
3. **Feature Planning:** Use scope management & DAG rules to estimate task graphs
4. **Security Audits:** Verify `.env.local` injection, key masking, zero-leak guarantees
5. **Iterative Updates:** Append new sections as features scale; maintain version history

---

> **Bottom Line:** We started with "I don't like my UI colors" and ended with a complete, production-ready architecture for an 
iterative, human-in-th



e is the exact, dependency-aware implementation order. Follow this sequence to avoid breaking changes, waste no credits, and build a stable, testable system.

---

### 🟦 PHASE 1: Foundation (Schema + Prompts)
*Do this first. Everything else depends on these types and rules.*

1. **Update Prisma Schema**
   - Add nullable integration fields to `Project` (`resendApiKey`, `supabaseUrl`, `supabaseAnonKey`, `stripeSecretKey`, etc.)
   - Verify `Message.plan` (String), `Message.planStatus` (Enum: pending/approved/rejected) exist
   - Run: `npx prisma generate` → `npx prisma db push`
2. **Update `TASK_GRAPH_PLAN_PROMPT`**
   - Replace with the enlarged version (scope limits, `riskFlags`, `nextStep`, hard task caps)
3. **Update `PROMPT` & `BACKEND_AGENT_PROMPT`**
   - Add the `SECURE ENVIRONMENT & API KEY HANDLING` block
   - Ensure `` output rule is intact

✅ **Verify Before Moving On:**
- `npx tsc --noEmit` passes
- Run a test prompt: `"Build a todo app."`
- Check DB: `message.plan` contains valid JSON with `tasks`, `riskFlags`, `nextStep`
- Planner respects MVP scope (4–8 tasks, no hallucinated routes)

---

### 🟨 PHASE 2: Backend Orchestration & Sandbox Injection
*Wire the approval gate and secure env injection before touching UI.*

4. **Build Approval Trigger (tRPC Mutation or API Route)**
   - Accepts `{ messageId, action: 'approve' | 'reject' }`
   - Updates `Message.planStatus` in Prisma
   - If `approve`: calls `inngest.send({ name: 'code-agent/run',  { messageId } })`
5. **Update `function.ts` for Sandbox Injection**
   - In the execution step, fetch project integration keys from Prisma
   - Dynamically format into single `.env.local` string
   - Write to sandbox: `await sandbox.files.write('.env.local', envString)`
   - Remove any individual `env.set()` calls per key
6. **Verify DAG Execution Flow**
   - Confirm `TaskExecutor` already runs correctly with `dependsOn`
   - Ensure fallback to single-task works if plan JSON fails to parse

✅ **Verify Before Moving On:**
- Manually update `planStatus: approved` in Prisma Studio
- Trigger `code-agent/run` → execution starts without errors
- Check sandbox: `.env.local` exists with correct key format
- No secrets appear in Inngest logs, Sentry, or AI context

---

### 🟧 PHASE 3: Frontend UI & Interaction
*Now that backend works, wire the user-facing approval & continuation flow.*

7. **Build Plan Approval Component**
   - Renders only when `message.planStatus === 'pending'`
   - Shows task list, `riskFlags` warning section, Approve/Reject buttons
   - Calls approval mutation, handles loading/error states, polls for status change
8. **Build Next Step Suggestion Chip**
   - Renders when `message.type === 'RESULT'` && valid `nextStep` in `message.plan`
   - Cleans text, auto-fills chat input on click, shifts focus, does NOT auto-submit
   - Hides silently if parsing fails
9. **Integrate into Chat Layout**
   - Place components in message renderer at correct lifecycle points
   - Ensure responsive, keyboard-accessible, semantic Tailwind styling

✅ **Verify Before Moving On:**
- User prompt → UI shows approval panel → click Approve → UI transitions to "Building..."
- Execution finishes → result shows → Next Step chip appears → click fills input cleanly
- Reject → UI clears, chat remains interactive
- No console errors, mobile layout intact

---

### 🟥 PHASE 4: Secure Integrations & Guided Setup
*Add the platform settings UI and generated-app key flow.*

10. **Build Platform Integrations Page**
    - Route: `/project/[id]/settings/integrations`
    - Masked inputs, reveal toggle, format validation, secure tRPC save
    - Helper text: "Keys are injected at runtime. Never appear in AI prompts."
11. **Verify AI Generates Guided Setup UI**
    - Pr

ASE 4: Secure Integrations & Guided Setup
*Add the platform settings UI and generated-app key flow.*

10. **Build Platform Integrations Page**
    - Route: `/project/[id]/settings/integrations`
    - Masked inputs, reveal toggle, format validation, secure tRPC save
    - Helper text: "Keys are injected at runtime. Never appear in AI prompts."
11. **Verify AI Generates Guided Setup UI**
    - Prompt already instructs AI to render `🔑 Missing [Service] key` banner + modal when `process.env` is undefined
    - Test with `"Add email notifications with Resend"` (no key saved yet)
    - Confirm mock runs, banner shows, modal saves key via platform API
12. **Wire Platform Key-Save API**
    - Receives key from generated app modal
    - Encrypts & saves to `Project` model
    - Triggers preview reload

✅ **Verify Before Moving On:**
- Missing key → app runs in mock mode + shows setup banner
- Paste key → saves securely → preview reloads → real API works
- Platform settings page masks keys, saves without exposing in responses
- Zero secret leakage in network tab or logs

---

### ⚫ PHASE 5: End-to-End Testing & Edge Cases
*Stress-test the full loop before shipping.*

13. **Run Full MVP Test**
    - Prompt: `"Build an n8n clone. Focus on a working MVP first."`
    - Verify: scoped plan → approve → DAG execution → next step chip → click → phase 2 continues
14. **Test Failure Paths**
    - Reject a plan → UI resets, no execution starts
    - Malformed plan JSON → graceful fallback, no crash
    - Sandbox timeout → error message saved, credits not double-charged
    - Missing keys → mock mode persists until user adds them
15. **Audit Security & Performance**
    - Scan logs/payloads for any leaked keys
    - Verify `.env.local` injection scales (add 5+ keys, test again)
    - Confirm credit deduction happens on prompt submission (not approval)
    - Check mobile responsiveness across approval, result, and integrations pages

✅ **Final Sign-Off Checklist:**
- [ ] Planner outputs scoped JSON with `riskFlags` & `nextStep`
- [ ] Approval gate works (approve/reject → Inngest resumes/cancels)
- [ ] DAG execution parallelizes safely, validates with `tsc`
- [ ] Next Step chip auto-fills input cleanly
- [ ] `.env.local` injection replaces individual `env.set()` calls
- [ ] Missing keys → mock + guided setup banner
- [ ] Zero secrets in prompts, frontend, or logs
- [ ] TypeScript compiles, no unhandled errors

---

### 💡 Credit-Saving Tips During Implementation
- **Test planner first** with cheap/free model before running full E2B execution
- **Use mock keys** in Phase 4 until UI flow is verified
- **Pause polling** when not actively testing to reduce DB/Inngest reads
- **Run `tsc` locally** before triggering sandbox saves to catch type errors early

Follow this exact order. Each phase builds on the previous one, requires no rework, and keep
