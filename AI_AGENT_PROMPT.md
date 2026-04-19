re is the **expanded, production-ready `SCOPE MANAGEMENT` block**, engineered specifically for your Isotope architecture (E2B sandbox limits, Inngest step constraints, Next.js 15 + tRPC + Prisma patterns, and multi-agent execution).

```text
═══════════════════════════════════════════════════════
SCOPE MANAGEMENT FOR LARGE REQUESTS (CRITICAL)
═══════════════════════════════════════════════════════
- If the request implies a full product ("clone", "SaaS", "platform", "IDE", "builder", "dashboard"), you MUST scope strictly to a functional MVP for this generation cycle.
- MVP DEFINITION: Core user loop only. 1 primary page → 1 essential data model → basic CRUD UI → working preview. All other features are explicitly deferred.
- PHASING RULE: Treat this prompt as "Phase 1". Do not attempt to build authentication flows, team management, billing, real-time sync, advanced editors, or third-party integrations unless explicitly requested as the immediate goal.
- HARD LIMITS PER CYCLE:
  • Max 8 tasks total
  • Max 3 database tables
  • Max 4 API routes / Server Actions
  • Max 12 frontend components/pages
  • Never exceed 3 files per single task
- COMPLEXITY CALIBRATION: If a single feature requires >3 steps to explain, split it into sub-tasks or defer to the next iteration. Prioritize working functionality over completeness.
- DEFERRED FEATURES LOG: List any major omitted features in `riskFlags` using this exact format: "Deferred: [Feature Name] — request in next prompt to add."
- ANTI-PATTERNS (NEVER DO):
  ❌ Do not generate placeholder/mock UI for complex systems (e.g., fake drag-and-drop, mock terminal, empty workflow canvas)
  ❌ Do not create empty API routes, database tables, or components without implementing the actual logic
  ❌ Do not assume future context will persist — make each generation cycle independently functional
  ❌ Do not exceed 3 files per task — split if needed
  ❌ Do not mix platform logic (Prisma/Inngest/Clerk) with generated app logic (Supabase/Client) in the same task
- SANDBOX & RUNTIME GUARDS:
  • E2B sandboxes timeout on heavy installs. Limit npm installs to ≤3 packages per task.
  • Inngest steps fail if tool calls exceed context. Keep each task description under 150 words.
  • If a task requires complex external APIs (Stripe, WebSockets, OAuth), defer it and use a mock/stub in Phase 1.
- ITERATION HANDOFF: Structure the final task to output a clear "next step" suggestion in the summary. The user should know exactly what prompt to run next to expand the app.
- When in doubt, prioritize a simple, working foundation over a complex, broken one. The user will iterate.
```

### 🔍 What Each Addition Solves
| Rule Added | Failure Mode It Prevents |
|------------|--------------------------|
| **Hard Limits (8 tasks, 3 tables, 4 routes, 12 components)** | Stops the planner from outputting bloated JSON that exceeds E2B sandbox memory or Inngest step timeouts |
| **Complexity Calibration** | Forces the AI to break vague requests ("add a dashboard") into atomic, executable units instead of hallucinating a full system |
| **Platform vs Generated App Separation** | Prevents the AI from accidentally mixing Isotope's internal Prisma/Clerk logic with the user's Supabase/Next.js app logic |
| **Sandbox & Runtime Guards** | Aligns with E2B's actual constraints: package install timeouts, tool call context limits, and async API delays |
| **Iteration Handoff** | Creates a natural user prompt loop (`"Deferred: Workflow Canvas — request next"`), turning one massive request into a reliable multi-step builder flow |

### 📍 Where to Paste
Replace your current `SCOPE MANAGEMENT` block in `TASK_GRAPH_PLAN_PROMPT` with this exact version. Keep it right after `PLANNING ORDER` and before `CONSTRAINTS`.

### 🧪 Expected Behavior After Update
User types: `"build an n8n clone"`  
AI outputs: A 6-task graph focusing on:
1. DB: `workflow` + `node` tables
2. Backend: `GET /api/workflows`, `POST /api/workflows`
3. UI: Workflow list page + create form
4. UI: Basic workflow detail shell
5. Integration: E2B preview wiring
6. Navigation: Add to sidebar
`riskFlags`: `"Deferred: Drag-and-drop canvas — request next"` | `"Deferred: Webhook triggers — request next"`

Test it. If you want me to also tighten the `CONSTRAINTS` section to lock JSON




e’s exactly how `riskFlags` and `nextStep` flow from the AI → your backend → your UI, and exactly what you need to wire up so the user sees them and can continue seamlessly.

---

### 🔁 1. How It Works End-to-End
| Phase | What Happens | Where Data Lives |
|-------|-------------|------------------|
| **Planning** | AI outputs JSON with `tasks`, `riskFlags`, and `nextStep` | Saved to `Message.plan` (Prisma `Json` field) |
| **Approval UI** | Frontend parses `plan` and renders tasks + flags | User clicks "Approve" or "Modify" |
| **Execution** | AI runs tasks, finishes with `` | Saved to new `Message.content` |
| **Post-Gen UI** | Frontend extracts `nextStep` from summary or plan | Shows as clickable chip + auto-fills input |

---

### 🛠️ 2. Fix the Prompt JSON Schema
Your current `TASK_GRAPH_PLAN_PROMPT` only outputs `tasks`. Update the **`OUTPUT FORMAT (MANDATORY)`** section to this:

```json
{
  "tasks": [
    {
      "id": "task_1",
      "type": "ui",
      "description": "Clear, actionable instruction",
      "files": ["app/page.tsx"],
      "dependsOn": [],
      "priority": 1
    }
  ],
  "riskFlags": ["Deferred: Drag-and-drop canvas", "Deferred: Webhook triggers"],
  "nextStep": "To continue, type: 'Add the drag-and-drop workflow canvas'"
}
```
**Why this works:** The AI now explicitly outputs `riskFlags` and `nextStep` alongside tasks. Your backend saves the entire object as JSON. No DB changes needed.

---

### 💾 3. Backend: How It's Stored (Already Works)
In `src/inngest/functions/function.ts`, you already do:
```ts
await prisma.message.update({
  where: { id: messageId },
   { plan: JSON.stringify(taskGraph), planStatus: 'pending' },
});
```
Since `taskGraph` now contains `riskFlags` and `nextStep`, they’re automatically persisted. Nothing else to change backend-side.

---

### 🖥️ 4. Frontend: How to Render It (React/Tailwind)
When the user opens the Plan Approval screen, parse `message.plan` and render:

```tsx
// components/PlanApproval.tsx
const plan = JSON.parse(message.plan)

return (

e User Sees `nextStep` After Generation
Once the AI finishes, your backend saves the ``. Extract `nextStep` and show it as a **clickable suggestion chip** below the chat input:

```tsx
// components/ChatInput.tsx
const [suggestion, setSuggestion] = useState(null)

// After generation completes:
useEffect(() => {
  const plan = JSON.parse(latestMessage.plan)
  setSuggestion(plan.nextStep || null)
}, [latestMessage])

return (
  
     setInput(e.target.value)}
      placeholder="Describe what to build..."
      className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground"
    />
    {suggestion && (
       setInput(suggestion.replace("To continue, type: ", "").replace(/'/g, ""))}
        className="absolute -top-8 left-0 px-2 py-1 text-xs bg-muted text-muted-foreground rounded-md border border-border hover:bg-background transition"
      >
        ✨ {suggestion}
      
    )}
  
)
```

---

### 🔄 6. Exact User Flow
1. User types: `"build an n8n clone"`
2. AI returns plan with `riskFlags` + `nextStep`
3. UI shows plan + `"⚠️ Deferred: Drag-and-drop canvas"`
4. User clicks **Approve**
5. AI builds MVP → finishes with ``
6. UI shows: `"Phase 1 complete. Next: Add the drag-and-drop workflow canvas"` as a clickable chip
7. User clicks chip → input auto-fills → hits Enter → AI continues from where it left off

---

### ✅ What You Need to Do Now
1. Update `TASK_GRAPH_PLAN_PROMPT` JSON schema to include `riskFlags` & `nextStep`
2. Add the `

3.  the `PlanApproval` render block to your frontend
3. Add the `nextStep` chip to your chat input
4. Test with `"create lovable clone"` → watch the plan UI render flags, approve, see the suggestion chip, click to continue.

No backend changes. No DB migrations. Just prompt sc

{
  "tasks": [
    {
      "id": "task_1",
      "type": "ui",
      "description": "Clear, actionable instruction",
      "files": ["app/page.tsx"],
      "dependsOn": [],
      "priority": 1
    }
  ],
  "riskFlags": ["Deferred: Drag-and-drop canvas", "Deferred: Webhook triggers"],
  "nextStep": "To continue, type: 'Add the drag-and-drop workflow canvas'"
}


// components/PlanApproval.tsx
const plan = JSON.parse(message.plan)

return (
  <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
    <h3 className="font-semibold text-foreground">Execution Plan</h3>
    <ul className="list-disc pl-5 text-sm text-muted-foreground">
      {plan.tasks.map((t) => (
        <li key={t.id}>[{t.type.toUpperCase()}] {t.description}</li>
      ))}
    </ul>

    {plan.riskFlags?.length > 0 && (
      <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
        <p className="text-sm font-medium text-amber-600">⚠️ Deferred Features</p>
        <ul className="mt-1 list-disc pl-4 text-xs text-amber-700 dark:text-amber-400">
          {plan.riskFlags.map((flag: string, i: number) => (
            <li key={i}>{flag}</li>
          ))}
        </ul>
      </div>
    )}

    <div className="flex gap-2 mt-4">
      <button onClick={() => handleReject()} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted">
        Reject
      </button>
      <button onClick={() => handleApprove()} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90">
        Approve & Build
      </button>
    </div>
  </div>
)

// components/ChatInput.tsx
const [suggestion, setSuggestion] = useState<string | null>(null)

// After generation completes:
useEffect(() => {
  const plan = JSON.parse(latestMessage.plan)
  setSuggestion(plan.nextStep || null)
}, [latestMessage])

return (
  <div className="relative">
    <input
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="Describe what to build..."
      className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground"
    />
    {suggestion && (
      <button
        onClick={() => setInput(suggestion.replace("To continue, type: ", "").replace(/'/g, ""))}
        className="absolute -top-8 left-0 px-2 py-1 text-xs bg-muted text-muted-foreground rounded-md border border-border hover:bg-background transition"
      >
        ✨ {suggestion}
      </button>
    )}
  </div>
)
  
    
