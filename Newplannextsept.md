// Should look like:
export interface TaskGraph {
  tasks: Task[];
  riskFlags?: string[];        // ← Add if missing
  nextStep?: string;           // ← Add if missing
}

# TASK: Build Plan Approval UI for message.plan

## 🎯 Objective
Create a component that safely reads the AI-generated execution plan from `message.plan`, renders it as an interactive approval interface, handles user actions, and triggers the existing backend workflow to begin code execution.

## 📥 Data Source & Flow (Confirmed by Your Backend)
- Read from the assistant message object: `message.plan` (JSON string) and `message.planStatus`
- Only render when `planStatus === 'pending'`
- The JSON contains:
  - `tasks`: array of { id, type, description, files, dependsOn, priority }
  - `riskFlags`: optional array of deferred feature warnings
  - `nextStep`: optional string suggestion for the next user prompt
  - `summary`: optional high-level plan description
- This data is saved by your `codeAgentFunction` in `function.ts` during the planning phase

## 🧭 Step-by-Step Guidance

### Step 1: Locate Integration Point
- Find your existing chat message renderer or assistant card component
- Identify where messages with `planStatus === 'pending'` currently display
- Plan to inject or replace that section with this approval interface only when pending
- Ensure the component unmounts or transitions smoothly once `planStatus` changes to `approved` or `rejected`

### Step 2: Safe Data Handling
- Wrap JSON parsing in error handling (try/catch)
- If the plan string is missing, empty, or malformed, render a graceful fallback (e.g., "Plan data unavailable. Please retry.")
- Cleanly extract tasks, riskFlags, nextStep, and summary for UI consumption
- Do not crash the chat if parsing fails — fail silently with a helpful message

### Step 3: UI Structure & Layout
- Show the plan summary at the top for quick context (if available)
- Render tasks in a clear, scannable list. Optionally group or tag them by type (db, backend, ui, integration)
- Display riskFlags in a visually distinct warning section:
  - Use semantic warning colors (`text-amber-600`, `bg-amber-500/10`, `border-amber-500/20`)
  - Include an alert icon (e.g., `AlertTriangle` from lucide-react)
  - Format each flag as: "Deferred: [Feature Name] — request in next prompt to add."
- Place two primary controls at the bottom:
  - **Approve**: Triggers backend workflow to start execution
  - **Reject**: Clears the approval UI and keeps chat interactive
- Keep layout compact, aligned with your chat container width, and fully responsive

### Step 4: Interaction & State Management
- Wire **Approve** to trigger your existing backend flow:
  1. Update `Message.planStatus` to `'approved'` via tRPC mutation or API route
  2. Re-emit the `code-agent/run` Inngest event with the same `messageId` to resume execution
- Wire **Reject** to:
  1. Update `Message.planStatus` to `'rejected'`
  2. Clear the approval UI
  3. Keep the chat input active so the user can modify their prompt
- Add loading states to both buttons:
  - Disable buttons while request is in flight
  - Show spinner or "Approving..." text
  - Use optimistic UI where appropriate, but always confirm with backend before transitioning
- Ensure the component listens for `planStatus` changes (via SWR polling, tRPC subscription, or state management) to auto-update when the backend confirms the action

### Step 5: Design & Accessibility
- Style exclusively with semantic Tailwind classes matching your Shadcn + Vercel dark theme:
  - Backgrounds: `bg-card`, `bg-muted/50`
  - Text: `text-foreground`, `text-muted-foreground`, `text-amber-600` (for warnings)
  - Borders: `border-border`, `border-amber-500/20`
  - Buttons: `bg-primary`, `text-primary-foreground`, `hover:opacity-90`
- Ensure hover, focus, active, and disabled states follow your design system
- Add proper ARIA labels to buttons and status indicators:
  - `aria-label="Approve plan and start building"`
  - `aria-label="Reject plan and modify prompt"`
- Guarantee full keyboard navigation:
  - Tab to buttons, Enter/Space to activate
  - Focus ring visible using `--ring` token
- Test mobile responsiveness:
  - Task list should scroll horizontally or wrap cleanly
  - Buttons should remain tappable (min 44px touch target)
  - Warning section should not overflow viewport

## ✅ Verification Checklist
- [ ] Component only renders when `message.planStatus === 'pending'`
- [ ] Invalid/missing JSON handled gracefully without breaking chat
- [ ] Approve correctly triggers backend workflow and updates UI state
- [ ] Reject updates status, clears UI, preserves chat continuity
- [ ] Loading states prevent double submissions and show clear progress
- [ ] Styling strictly uses semantic tokens, matches existing Vercel dark theme
- [ ] Fully responsive, keyboard accessible, screen reader friendly
- [ ] TypeScript compiles with zero errors or type mismatches
- [ ] Component auto-updates when `planStatus` changes (via polling or subscription)

## 🔄 Expected User Flow
1. AI planner finishes → saves plan to database with `planStatus: 'pending'`
2. Chat UI renders this component below the assistant message
3. User reviews tasks and riskFlags
4. User clicks **Approve** → UI shows loading → backend confirms → execution phase begins → component unmounts
5. User clicks **Reject** → status updates → approval UI disappears → chat resets for next prompt

## 📦 Final Output Requirement
After completing all steps, output exactly:
<task_summary>
Implemented Plan Approval component for message.plan. Added safe JSON parsing, task and risk flag rendering, approve/reject state handling, backend workflow integration, and design-system aligned UI with full responsiveness and accessibility.
</task_summary>


# TASK: Build Next Step Continuation UI Chip

## 🎯 Objective
Create a subtle, clickable suggestion component that appears after generation finishes. It reads the `nextStep` field from the saved plan, cleans the text, and auto-fills the chat input so users can continue building without guessing what to type next.

## 📥 Data Source & Flow (Confirmed by Your Backend)
- Read from the same `message.plan` JSON string used in the approval phase
- Extract the `nextStep` field only after generation completes:
  - `message.type === 'RESULT'` (not ERROR or pending)
  - `message.plan` contains valid JSON with a `nextStep` string
- Example stored value: `"To continue, type: 'Add the drag-and-drop workflow canvas'"`
- This data persists in `Message.plan` after execution — no extra database calls needed

## 🧭 Step-by-Step Guidance

### Step 1: Locate Integration Point
- Find where assistant `RESULT` messages are rendered in your chat flow
- Plan to render this suggestion component **immediately below** the assistant message card or in a dedicated continuation area
- Only show when:
  - `message.type === 'RESULT'`
  - `message.plan` exists and parses successfully
  - `plan.nextStep` exists and is non-empty after cleaning
- Hide automatically if any condition fails — no fallback text, no layout shift

### Step 2: Safe Data Handling & Text Cleaning
- Parse the plan JSON safely with try/catch error handling
- Extract the `nextStep` string
- Clean the text by stripping:
  - Prefixes: `"To continue, type: "`, `"Next: "`, `"Continue with: "` (case-insensitive)
  - Surrounding quotes: single or double quotes at start/end
  - Extra whitespace: `.trim()` the final result
- If the cleaned text is empty, undefined, or parsing fails, render nothing silently
- Do not log errors to console in production — fail gracefully

### Step 3: UI Structure & Interaction
- Render as a single-row, clickable chip with:
  - A small AI/sparkle icon on the left (e.g., `Sparkles` or `Zap` from lucide-react)
  - The cleaned suggestion text in a muted, readable font
  - Subtle hover state that elevates the chip slightly
- Style subtly using your Vercel dark theme so it feels like a helper, not a primary action:
  - Background: `bg-muted/50` or `bg-card`
  - Border: `border border-border`
  - Text: `text-muted-foreground` with `group-hover:text-foreground`
  - Icon: `text-primary` for visual pop
- On click:
  1. Auto-fill the chat input field with the cleaned text
  2. Shift focus to the input field so the user can immediately edit or submit
  3. Do NOT auto-submit — let the user press Enter manually
- Ensure the input preserves cursor position and remains fully editable after filling

### Step 4: Design & Edge Cases
- Use semantic Tailwind classes only — no hardcoded colors or arbitrary values:
  - `bg-muted/50`, `text-muted-foreground`, `border-border`, `text-primary`, `hover:bg-background`
- Ensure no layout shift on mobile or desktop when the chip appears/disappears:
  - Use `transition-opacity` or `transition-height` if animating
  - Reserve minimal space or let it flow naturally without pushing content
- Hide automatically if:
  - `message.plan` is missing or malformed
  - `nextStep` is empty after cleaning
  - `message.type !== 'RESULT'`
- Maintain proper contrast and hover/focus states aligned with your Vercel dark theme
- Ensure the chip is keyboard-accessible:
  - `role="button"`, `tabIndex=0`, `onKeyDown` for Enter/Space activation
  - Visible focus ring using `--ring` token
- Test mobile responsiveness:
  - Chip should not overflow viewport width
  - Tap target should be at least 44px tall for easy tapping
  - Text should wrap cleanly or truncate with ellipsis if too long

## ✅ Verification Checklist
- [ ] Component only renders when `message.type === 'RESULT'` AND `plan.nextStep` exists and is valid
- [ ] Parsing failures or empty values render nothing silently (no console errors)
- [ ] Clicking the chip fills the input exactly — no extra quotes, prefixes, or whitespace
- [ ] Input remains editable after filling; focus shifts correctly to the text field
- [ ] No layout shift on mobile or desktop when chip appears/disappears
- [ ] Styling uses semantic tokens only, matches existing Vercel dark theme
- [ ] Chip is keyboard-accessible with proper ARIA attributes and focus ring
- [ ] TypeScript compiles cleanly with zero errors or type mismatches
- [ ] Component unmounts cleanly when navigating away from the chat

## 🔄 Expected User Flow
1. AI finishes generation → saves `RESULT` message with `plan` containing `nextStep`
2. Chat renders assistant message + Next Step chip below it (if valid)
3. User sees suggestion: `✨ Add the drag-and-drop workflow canvas`
4. User clicks chip → chat input auto-fills with clean prompt text
5. User reviews/edits if needed → presses Enter → AI receives continuation prompt and builds on previous work

## 📦 Final Output Requirement
After completing all steps, output exactly:
<task_summary>
Implemented Next Step continuation UI chip. Added plan JSON parsing, safe text extraction, clickable chip rendering, and input auto-fill wiring. Positioned below assistant results with Vercel dark theme alignment, keyboard accessibility, and robust error handling.
</task_summary>


# TASK: Build Approval Trigger Mutation & Client Integration

## 🎯 Objective
Create a server-side mutation (tRPC or Next.js API route) and corresponding client hook that handles plan approval/rejection, updates the database, triggers the Inngest execution workflow, and keeps the UI in sync with real-time status changes.

## 📥 Data Flow & Architecture (Confirmed by Your Backend)
- Frontend component calls this mutation with `messageId` and `action` (`'approve'` or `'reject'`)
- Server updates `Message.planStatus` in Prisma to match the action
- If `approve`: Server emits `code-agent/run` Inngest event with the same `messageId`
- Inngest receives event → checks `planStatus === 'approved'` → skips planning phase → starts `TaskExecutor`
- Client receives success response → invalidates cache or updates local state → UI transitions out of approval view
- If `reject`: Server updates status → client clears approval UI → chat input remains active for prompt modification

## 🧭 Step-by-Step Guidance

### Step 1: Server-Side Mutation/Route Setup
- Create a dedicated endpoint (tRPC mutation or `/api/plan-status` route) that accepts:
  - `messageId` (string)
  - `action` (`'approve' | 'reject'`)
- Validate inputs strictly. Reject malformed requests with appropriate HTTP/tRPC errors
- Use Prisma to update `Message.planStatus` to the matching enum value
- Wrap the database update in a transaction if you add logging, analytics, or audit trails later
- Return a clean success response with the updated status

### Step 2: Inngest Event Emission (Approve Path Only)
- When `action === 'approve'`:
  - Import your existing `inngest` client instance
  - Call `inngest.send()` with event name `code-agent/run`
  - Include `messageId` in the event payload exactly as your `function.ts` expects
  - Do not include `value` or `imageUrl` in this payload — the execution phase reads them from the existing message
  - Handle potential send failures gracefully: log to Sentry, return a safe error to the client, do not crash the route
- When `action === 'reject'`:
  - Skip Inngest emission entirely
  - Return success immediately

### Step 3: Client-Side Hook & Integration
- Create a custom hook or wrapper function that exposes `approvePlan(messageId)` and `rejectPlan(messageId)`
- Use your existing data-fetching pattern (tRPC hooks, SWR, or React Query) for cache management
- Implement optimistic updates if your UI framework supports it, but always revert on server error
- Invalidate or refetch the affected message after success to pull the latest `planStatus`
- Ensure the hook exposes `isLoading`, `isError`, and `error` states for the UI to consume

### Step 4: State Sync & UI Feedback
- Wire the hook to your Plan Approval component's button handlers
- Show loading indicators on both buttons while the request is in flight
- Disable buttons during loading to prevent duplicate submissions
- On success:
  - If approved: UI should smoothly unmount or fade out as the message transitions to execution state
  - If rejected: UI clears instantly, chat input stays focused, user can modify prompt
- On error:
  - Show a non-blocking toast or inline error message
  - Keep approval UI visible so the user can retry
  - Log the error to Sentry for debugging

### Step 5: Real-Time Status Updates (Optional but Recommended)
- Since Inngest execution happens asynchronously, the UI must know when execution actually starts
- Implement one of these patterns:
  - SWR/React Query polling every 2–3 seconds while `planStatus === 'pending'`
  - Server-Sent Events (SSE) or tRPC subscriptions if already in your stack
  - Fallback: Optimistic transition to "Building..." state, then poll for completion
- Ensure the chat auto-updates when `planStatus` changes from `pending` → `approved` → execution begins

## ✅ Verification Checklist
- [ ] Mutation accepts only `messageId` + `action`, rejects invalid inputs
- [ ] Prisma `planStatus` updates correctly for both approve and reject
- [ ] Inngest event emits only on approve, with correct `messageId` payload
- [ ] Client hook exposes loading, success, and error states cleanly
- [ ] Buttons disable during flight, prevent double-clicks
- [ ] UI transitions smoothly on success, stays stable on error
- [ ] Polling/subscription correctly detects status changes
- [ ] TypeScript compiles with zero errors
- [ ] No console errors or unhandled promise rejections

## 🔄 Expected User Flow
1. User clicks **Approve** → hook sends request → server updates DB → Inngest event fires
2. UI shows loading → request succeeds → status updates to `approved`
3. Inngest picks up event → `function.ts` sees `approved` → starts `TaskExecutor`
4. UI polls/updates → transitions from approval view to "Building..." state
5. User clicks **Reject** → server updates DB → UI clears → chat input stays active

## 📦 Final Output Requirement
After completing all steps, output exactly:
<task_summary>
Implemented approval trigger mutation and client integration. Added Prisma status updates, conditional Inngest event emission, optimistic UI handling, error boundaries, and real-time status sync for seamless plan approval workflow.
</task_summary>


e Plan Approval + Next Step flow. Here's the breakdown:

---

### ✅ What's Already Perfect
| Model | Field | Why It Works |
|-------|-------|-------------|
| **`Message`** | `plan: String?` | Stores the full JSON plan (`tasks`, `riskFlags`, `nextStep`) as a string. No schema changes needed. |
| **`Message`** | `planStatus: PlanStatus?` | Enum `pending \| approved \| rejected` matches our flow exactly. |
| **`Fragment`** | `files: Json` | Persists generated files for vector store, GitHub sync, and UI preview. |
| **`Fragment`** | `branchName: String?` | Enables persistent feature branch (`isotope-generated-${projectId}`). |
| **`Credits`** | `CreditEventReason.generation` | Clear hook for credit deduction logic. |

---

### ⚠️ Critical Items to Verify

#### 1. **`TaskGraph` TypeScript Interface** (High Priority)
**File:** `@/execution/taskGraph.ts` (or wherever `TaskGraph` is defined)
**Check:** Does it include `riskFlags` and `nextStep`?
```typescript
// Should look like:
export interface TaskGraph {
  tasks: Task[];
  riskFlags?: string[];        // ← Add if missing
  nextStep?: string;           // ← Add if missing
}
```
**Why:** If these fields aren't in the type, TypeScript may strip them or cause errors when the planner outputs them.

#### 2. **Timestamp Typo** (Low Priority but Clean)
**Schema:**
```prisma
createAt  DateTime @default(now())  // ← Should be `createdAt`
```
**Impact:** Frontend code must use `message.createAt` (not `createdAt`). If you fix this, run `npx prisma generate` and update any frontend references.

#### 3. **Credit Deduction Timing** (Medium Priority)
**Question:** When is the `generation` credit event created?
- ✅ **Best:** On initial prompt submission (before planning)
- ⚠️ **Risky:** On plan approval (user might reject)
- ⚠️ **Risky:** On execution start (sandbox timeouts)

**Check your `resetFreeCredits` or credit deduction logic** to ensure it fires **before** planning, not after approval.

---

### 🎯 Frontend Hook Points (Confirmed by Schema)

#### Plan Approval Component
```typescript
// Render when:
message.planStatus === 'pending'

// Read data from:
JSON.parse(message.plan) // → { tasks, riskFlags?, nextStep? }

// Actions:
- Approve: Update planStatus to 'approved' → re-emit code-agent/run
- Reject: Update planStatus to 'rejected' → clear UI
```

#### Next Step Suggestion Chip
```typescript
// Render when:
message.type === 'RESULT' && message.plan?.includes('"nextStep"')

// Read data from:
const plan = JSON.parse(message.plan)
const suggestion = plan.nextStep?.replace(/To continue, type: ['"]?/i, '').replace(/['"]$/g, '').trim()

// Action:
- On click: Auto-fill chat input with `suggestion`
```

---

### 🚀 Immediate Next Steps (Priority Order)

1. **Verify `TaskGraph` type** includes `riskFlags?` and `nextStep?`  
   *(If you paste `@/execution/taskGraph.ts`, I'll confirm in 10 seconds)*

2. **Implement approval trigger mutation** (tRPC or API route)  
   Example shape:
   ```typescript
   // POST /api/approve-plan
   { messageId: string, action: 'approve' | 'reject' }
   // → Updates Message.planStatus → re-emits code-agent/run if approve
   ```

3. **Add frontend polling/SWR** to detect `planStatus` changes  
   *(So UI updates automatically when backend approves/rejects)*

4. **Paste Plan Approval UI prompt** into your coding agent  
   *(I'll re-paste it cleanly once you confirm #1)*

---

### 🔍 Quick Sanity Check
Run this in Prisma Studio or your console after a test prompt:
```typescript
const msg = await prisma.message.findUnique({
  where: { id: 'your-test-message-id' },
  select: { plan: true, planStatus: true, type: true }
})
console.log('Status:', msg.planStatus)
console.log('Plan:', JSON.parse(msg.plan ?? '{}'))
// Should show: { tasks in: [...], riskFlags: [...], nextStep: "..." }
```

---

### 📦 What I Need From You Next
1. Paste `@/execution/taskGraph.ts` (or confirm the `TaskGraph` interface includes `riskFlags?` and `nextStep?`)
2. Tell me if you want me to:
   - Re-paste the **Plan Approval UI prompt** now
   - Help draft the **approval trigger mutation** (tRPC/API)
   - A
