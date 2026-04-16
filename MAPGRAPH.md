PHASE 1: Foundation
├─ Update Prisma schema (integration fields)
├─ Update TASK_GRAPH_PLAN_PROMPT (scope limits, riskFlags, nextStep)
├─ Update PROMPT + BACKEND_AGENT_PROMPT (secure env rules)
└─ Verify: npx tsc passes, test prompt outputs valid JSON

PHASE 2: Backend Orchestration & Sync
├─ Build approval trigger mutation (tRPC/API)
├─ Update function.ts for .env.local sandbox injection
├─ Verify DAG execution with dependsOn
├─ [ALREADY WIRED] GitHub sync step runs post-execution → pushes to branch
└─ Verify: approve → execution starts → .env.local injected → branch pushed to GitHub

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
├─ Verify GitHub branch created, files pushed, Fragment.branchName updated
├─ Test failure paths: reject, malformed JSON, timeout, missing keys
├─ Audit security: zero secret leakage, credit timing, mobile responsiveness
└─ Sign-off: all checklists pass
