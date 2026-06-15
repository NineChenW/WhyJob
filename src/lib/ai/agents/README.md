┌─────────────────────────────────────────────────────────────────────────┐
│ Extension (Chrome) │
│ │
│ 1. pickup() ──────► POST /pickup ──────► Returns taskId │
│ │
│ 2. poll commands ──► GET /commands ────────────► Returns command │
│ ?extensionId=xxx&taskId=yyy (NAVIGATE/EXTRACT) │
│ │
│ 3. execute in browser │
│ │
│ 4. post results ───► POST /results ────────────► Updates state │
│ { extensionId, results[] } (discovery added) │
│ │
│ 5. repeat from step 2 until no more commands │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Server (Next.js) │
│ │
│ /pickup: │
│ - Check for existing exploring task (prevents duplicates) │
│ - Pick oldest pending task, mark as "exploring" │
│ - Return taskId │
│ │
│ /commands (GET): │
│ - Load task state from DB │
│ - THINK: Run decideNextAction() ONE iteration │
│ - Store currentAction/currentTarget in DB │
│ - Return command to extension │
│ - If GENERATE_CONFIG → complete task │
│ - If FAIL → mark failed │
│ │
│ /results (POST): │
│ - Load task state from DB │
│ - OBSERVE: Analyze result, create discovery │
│ - INCREMENT: iterations++ │
│ - Store updates in DB │
│ - Extension polls /commands for next step │
└─────────────────────────────────────────────────────────────────────────┘

Key Files Changed
File Purpose
prisma/schema.prisma Added pagesVisited, discoveries, currentAction, currentTarget
src/lib/db/explorer.ts Added agent state DB helpers
src/lib/ai/agents/explorer-act.ts Stateless ACT loop functions
src/app/api/agent/commands/route.ts Runs ONE iteration, returns command
src/app/api/agent/results/route.ts Processes result, updates DB
src/app/api/explorer/tasks/pickup/route.ts Simplified - just marks task
Each API Call is Stateless & Atomic
pickup() - Just marks task, returns ID
GET /commands?taskId=xxx - ONE iteration → returns command OR completes/fails
POST /results - ONE result → updates state
This is much simpler because:

No long-running agent process
No complex state management
Extension controls the polling pace
State persists in DB (resumable)
Each step is independent and debuggable
