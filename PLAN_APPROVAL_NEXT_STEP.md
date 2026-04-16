# TASK: Build Plan Approval UI for message.plan

## 🎯 Objective
Create a component that safely reads the AI-generated execution plan, renders it as an interactive approval interface, handles user actions, and triggers the existing backend workflow to begin code execution.

## 📥 Data Source & Flow
- Read from the assistant message object: `message.plan` (JSON string) and `message.planStatus`
- Only render when `planStatus === 'pending'`
- The JSON contains: `tasks` (array), `riskFlags` (optional array), `nextStep` (string), and `summary` (optional)

## 🧭 Step-by-Step Guidance

### Step 1: Locate Integration Point
- Find your existing chat message renderer or assistant card component
- Identify where messages with a pending plan status currently display
- Plan to inject or replace that section with this approval interface only when pending

### Step 2: Safe Data Handling
- Wrap JSON parsing in error handling
- If the plan string is missing, empty, or malformed, render a graceful fallback (e.g., "Plan data unavailable. Please retry.")
- Cleanly extract tasks, riskFlags, nextStep, and summary for UI consumption

### Step 3: UI Structure & Layout
- Show the plan summary at the top for quick context
- Render tasks in a clear, scannable list. Optionally group or tag them by type (db, backend, ui, integration)
- Display riskFlags in a visually distinct warning section using semantic warning colors and an alert icon
- Place two primary controls at the bottom: Approve and Reject
- Keep layout compact, aligned with your chat container width, and fully responsive

### Step 4: Interaction & State Management
- Wire Approve to trigger your existing backend flow that updates `planStatus` to approved and resumes the Inngest execution phase
- Wire Reject to update `planStatus` to rejected, clear the approval UI, and keep the chat interactive
- Add loading states to both buttons to prevent double submissions and show clear progress
- Use optimistic UI where appropriate, but always confirm with backend before transitioning to execution state

### Step 5: Design & Accessibility
- Style exclusively with semantic Tailwind classes matching your Shadcn Vercel dark theme
- Ensure hover, focus, active, and disabled states follow your design system
- Add proper ARIA labels to buttons and status indicators
- Guarantee full keyboard navigation and screen reader compatibility
- Test mobile responsiveness to ensure lists and buttons remain usable on small screens

## ✅ Verification Checklist
- Component only renders when message.planStatus equals pending
- Invalid/missing JSON handled gracefully without breaking chat
- Approve correctly triggers backend workflow and updates UI state
- Reject updates status, clears UI, preserves chat continuity
- Loading states prevent double submissions
- Styling strictly uses semantic tokens, matches existing design system
- Fully responsive, keyboard accessible, screen reader friendly
- TypeScript compiles with zero errors

## 📦 Final Output Requirement
After completing all steps, output exactly:
<task_summary>
Implemented Plan Approval component for message.plan. Added safe JSON parsing, task and risk flag rendering, approve/reject state handling, backend workflow integration, and design-system aligned UI with full responsiveness and accessibility.
</task_summary>


# TASK: Build Next Step Continuation UI

## 🎯 Objective
Create a subtle, clickable suggestion component that appears after generation finishes. It reads the `nextStep` field from the saved plan, cleans the text, and auto-fills the chat input so users can continue building without guessing what to type next.

## 📥 Data Source & Flow
- Read from the same `message.plan` JSON string used in the approval phase
- Extract the `nextStep` field only after the generation completes (`planStatus` no longer pending, message type is RESULT)
- The field contains a phrase like: "To continue, type: 'Add the drag-and-drop canvas'"

## 🧭 Step-by-Step Guidance

### Step 1: Locate Integration Point
- Find where assistant RESULT messages are rendered in your chat flow
- Plan to render this suggestion component immediately below the assistant message card or in a dedicated continuation area
- Only show when the message contains a valid `nextStep` value

### Step 2: Safe Data Handling & Text Cleaning
- Parse the plan JSON safely with error handling
- Extract the `nextStep` string
- Strip prefixes like "To continue, type: " and remove surrounding quotes
- If the cleaned text is empty, undefined, or parsing fails, render nothing

### Step 3: UI Structure & Interaction
- Render as a single-row, clickable chip with a small AI/sparkle icon
- Style subtly using your design system so it feels like a helper, not a primary action
- On click, auto-fill the chat input field with the cleaned text
- Do NOT auto-submit. Let the user review, edit, or press Enter manually
- After filling, shift focus to the input field for immediate editing

### Step 4: Design & Edge Cases
- Use semantic Tailwind classes only: muted backgrounds, subtle borders, primary accent on hover/icon
- Ensure no layout shift on mobile or desktop when the chip appears/disappears
- Hide automatically if no valid `nextStep` exists
- Maintain proper contrast and hover/focus states aligned with your Vercel dark theme
- Ensure the input preserves cursor position and remains fully editable after filling

## ✅ Verification Checklist
- Component only renders when message.plan contains a valid nextStep
- Parsing failures or empty values render nothing silently
- Clicking fills the input exactly, with no extra quotes or prefixes
- Input remains editable; focus shifts correctly
- No layout shift on mobile or desktop
- Styling uses semantic tokens, matches existing chat aesthetic
- TypeScript compiles cleanly
- Zero console errors during parsing or rendering

## 📦 Final Output Requirement
After completing all steps, output exactly:
<task_summary>
Implemented Next Step continuation UI. Added plan JSON parsing, safe text extraction, clickable chip rendering, and input auto-fill wiring. Positioned below assistant results with design-system alignment and robust error handling.
</task_summary>
