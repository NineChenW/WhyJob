# Explorer Agent - LangGraph Wiring Spec

## Overview

This spec wires the existing LangGraph infrastructure (Iteration 10) into the task processing flow. The key change: `runExplorerGraph()` (LangGraph AI) replaces `explore()` (rule-based ACT loop) as the task processing engine.

**Key distinction from current pattern:**
- **Current (explorer-act.ts)**: Commands API is the "brain" — decides next action, extension is pure executor
- **New (explorer-graph.ts)**: LangGraph agent is the "brain" — runs ReAct loop, Commands API just returns queued commands

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LangGraph Explorer Agent                             │
│                                                                              │
│   State: taskId, company, iterations, discoveries, reactTrace, etc.       │
│                                                                              │
│   Nodes:                                                                    │
│   - llm_decision      → AI decides next ReAct action                          │
│   - check_termination → Checks for GENERATE_CONFIG / FAIL / max_iterations   │
│   - execute_tool      → Executes tools (async or sync)                     │
│   - observe_result    → Parses discoveries from tool output                  │
│   - reflect           → Updates confidence based on observation              │
│   - generate_config   → Builds FetchConfig from discoveries                  │
│   - test_config       → Tests generated FetchConfig via HTTP                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ runExplorerGraph() called with taskId
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Routes                                        │
│                                                                              │
│   POST /api/explorer/tasks/pickup   → Triggers runExplorerGraph()          │
│   GET  /api/agent/commands          → Returns queued commands from agent    │
│   POST /api/agent/results           → Extension posts results → agent resumes │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP Polling (Extension ↔ Browser)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Chrome Extension                                    │
│                                                                              │
│   - Receives commands via GET /commands (by taskId)                        │
│   - Executes NAVIGATE, GET_SNAPSHOT, EXTRACT_DOM, etc.                     │
│   - Posts results back via POST /results                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Processing Flow

### Current Flow (explorer-act.ts)

```
Pickup → Commands GET (decide) → Extension executes → Results POST → Commands GET (decide) → ...
```

The Commands API is the "brain" — it decides the next action each time the extension polls.

### New Flow (explorer-graph.ts)

```
Pickup → runExplorerGraph() starts → llm_decision → check_termination
         ↓
    execute_tool (async) → queue command → return EARLY (status=0)
         ↓
    [Graph returns - waiting for extension result]

Extension polls Commands GET → gets queued command
Extension executes → POST /results

    [Results POST updates state log → sets status=1]

runExplorerGraph() is called again (by server action / cron) with same taskId
         ↓
    llm_decision detects pending tool → returns NOOP
    execute_tool → checks pending call → waitForResult() → gets cached result
         ↓
    observe_result → reflect → llm_decision → loop

...continue until generate_config → test_config → END
```

---

## State Persistence Strategy

The key challenge: LangGraph's `runExplorerGraph()` doesn't run continuously — it returns when it hits an async tool (status=0). We need to persist state so the next pickup/process call can resume.

### Persistence via AgentStateLog + FetchTask

Every node call logs to `AgentStateLog`:
- `status=0` (Hang up) = waiting for async result
- `status=1` (Done) = completed

The `FetchTask.currentAction` / `currentTarget` fields continue to track what's pending for extension polling.

### Resume Trigger

On Results POST:
1. Update AgentStateLog with result (set `status=1`, store `toolCall.output`)
2. If task was marked "exploring" by pickup, trigger re-invoke

### Server-Side Re-invoke Strategy

Since Next.js API routes are stateless, we need a trigger for re-invoke:

**Option A: Client polling** (extension polls `/api/explorer/tasks/process` after each result POST)
**Option B: Background job** (cron/enqueue checks for hanging tasks and re-invokes)
**Option C: Direct enqueue** (Results API triggers async job)

For simplicity, use **Option A**: After POSTing results, the extension (or the admin UI) polls `/api/explorer/tasks/process` which re-invokes the graph for the task.

---

## Key Changes

### 1. `/api/explorer/tasks/pickup/route.ts`

**Change:** After picking up task, start `runExplorerGraph()`.

```typescript
// Current (picks up task, returns task info)
const task = await prisma.fetchTask.update({
  where: { id: pendingTask.id },
  data: { status: 'exploring' },
});
return NextResponse.json({ pickedUp: true, task });

// New: Start runExplorerGraph after pickup
const task = await prisma.fetchTask.update({
  where: { id: pendingTask.id },
  data: { status: 'exploring' },
});

// Start the graph (async - don't block)
runExplorerGraphAsync(task.id, serverUrl).catch(console.error);

return NextResponse.json({ pickedUp: true, task, message: 'Exploration started' });
```

### 2. `/api/explorer/tasks/process/route.ts`

**Change:** Replace `explore()` call with `runExplorerGraph()`.

```typescript
// Current
const result = await explore(explorationTask, extension);

// New: runExplorerGraph uses ChromeExtensionTool internally
const { runExplorerGraph, initializeExplorationState, ChromeExtensionTool } = require('@/lib/ai/agents/explorer');

const state = initializeExplorationState({
  taskId: task.id,
  companyId: task.companyId,
  company: { id: company.id, name: company.name, website: company.website, industry: company.industry },
  contentTypes: task.contentTypes,
  maxIterations: 5,
});

const tool = new ChromeExtensionTool(serverUrl, task.id);
const result = await runExplorerGraph(state, serverUrl);
```

**Note:** `runExplorerGraph` already instantiates `ChromeExtensionTool` internally. But we need to pass the taskId so the tool can POST commands.

Actually, `runExplorerGraph` takes `(state, serverUrl)` and creates `ChromeExtensionTool` inside. This should work.

### 3. `/api/agent/commands/route.ts` — GET

**Change:** When LangGraph agent is running, GET should return commands from the agent's queued commands, not from rule-based `decideNextAction()`.

The challenge: the Commands GET is called by the extension (polling). The LangGraph agent queues commands via `ChromeExtensionTool.postCommand()`. But after `runExplorerGraph` returns (with status=0), how does the extension get the queued command?

**Solution:** The queued command is already stored in `FetchTask.currentAction/currentTarget`. The Commands GET already returns commands based on these fields — this part works!

But we need to distinguish: is this task running the new LangGraph agent or the old rule-based agent?

**Approach:** Add a flag to FetchTask: `agentType: 'rule-based' | 'langgraph'`. Or check if `AgentStateLog` entries exist for this taskId (indicating LangGraph agent).

Actually, for simplicity, the Commands GET can check: if `currentAction` is set (from LangGraph's execute_tool posting), return that command. This already works!

### 4. `/api/agent/results/route.ts` — POST

**Change:** After updating `FetchTask` (existing logic), also update `AgentStateLog` if present (for LangGraph resume).

```typescript
// After existing FetchTask update logic:
const hangingLog = await getLatestStateLog(taskId);
if (hangingLog && hangingLog.status === 0) {
  // Update AgentStateLog with result
  const existingNote = (hangingLog.note as StateLogNote) || {};
  const updatedNote: StateLogNote = {
    ...existingNote,
    toolCall: {
      tool: existingToolCall?.tool ?? 'unknown',
      input: existingToolCall?.input ?? {},
      output: result.data,
      error: result.error,
    },
    asyncTool: {
      toolName: existingAsyncTool?.toolName ?? 'chrome_extension',
      requestId: existingAsyncTool?.requestId ?? result.requestId,
      commandQueued: existingAsyncTool?.commandQueued ?? true,
      waitingForResult: false,
    },
  };

  await updateStateLog(hangingLog.id, {
    status: 1,
    nextNode: 'observe_result',
    note: updatedNote,
  });

  // Trigger re-invoke
  await prisma.fetchTask.updateMany({
    where: { id: taskId, status: 'exploring' },
    data: { status: 'pending' }, // Mark for pickup/process
  });
}
```

Wait, updating to 'pending' and then pickup would restart the graph fresh. We need to resume with the SAME state.

**Better approach:** Use `getResumeContext(taskId)` to get the saved state and re-invoke `runExplorerGraph` with it:

```typescript
if (hangingLog && hangingLog.status === 0) {
  // Get resumed state from state log
  const resumeContext = await getResumeContext(taskId);
  if (resumeContext) {
    // Re-invoke graph with saved state
    const { runExplorerGraph } = require('@/lib/ai/agents/explorer');
    const result = await runExplorerGraph(resumeContext.state, serverUrl);
    // Handle result...
  }
}
```

But this requires `runExplorerGraph` to support resume (taking existing state, not initializing new). The current implementation initializes fresh state.

### 5. Resume Support in `runExplorerGraph`

**Change:** Add resume mode that loads state from `getResumeContext(taskId)`.

```typescript
export async function runExplorerGraph(
  state: ExplorationState,
  serverUrl: string,
  options?: { resume?: boolean; taskId?: string }
): Promise<ExplorationState> {
  if (options?.resume && options.taskId) {
    const context = await getResumeContext(options.taskId);
    if (context) {
      state = context.state as ExplorationState;
    }
  }
  // ... rest of implementation
}
```

Or simpler: have the caller pass the state to resume with.

Actually, the cleanest approach is to store the `ExplorationState` in `FetchTask` as JSON when hanging, and load it on re-invoke. But that's a bigger change.

### 6. `runExplorerGraph` Async Return Handling

**Problem:** The current `runExplorerGraph` returns when hitting an async tool (status=0). But it returns a `Promise<ExplorationState>` — it doesn't "suspend and resume".

**Solution:** `runExplorerGraph` needs to be split or use LangGraph's checkpointing:

```typescript
export async function runExplorerGraph(
  state: ExplorationState,
  serverUrl: string
): Promise<ExplorationState> {
  const graph = createExplorerGraph();
  const compiled = graph.compile();
  const tool = new ChromeExtensionTool(serverUrl, state.taskId);

  // Check for resume
  const resumeContext = await getResumeContext(state.taskId);
  if (resumeContext) {
    state = resumeContext.state as ExplorationState;
  }

  // Invoke - if async tool encountered, throws custom exception
  try {
    const result = await compiled.invoke(state, { configurable: { tool } });
    return result as ExplorationState;
  } catch (error) {
    if (error instanceof AsyncToolHangingError) {
      // State is already logged with status=0, return current state
      return error.currentState;
    }
    throw error;
  }
}
```

But throwing from inside a node is awkward with LangGraph.

**Better approach:** Use LangGraph's built-in checkpointing / managed state. When `execute_tool` handles an async tool, it sets `waitingForExtensionResult: true` in state and returns. LangGraph's `compiled.invoke()` will return this modified state. The caller checks if `waitingForExtensionResult` is true — if so, the task is "paused". When results come in, caller re-invokes with the same state (which has the pending tool call).

This is the cleanest approach — LangGraph state IS the checkpoint. The caller just re-invokes with the returned state when ready.

---

## File Structure

No new files — wiring changes only:

```
src/
├── app/api/explorer/tasks/
│   ├── pickup/route.ts        # Start runExplorerGraph after pickup
│   └── process/route.ts        # Re-invoke runExplorerGraph for resume
├── app/api/agent/
│   ├── commands/route.ts       # GET: Return commands from LangGraph agent (via currentAction)
│   └── results/route.ts       # POST: Update state log, trigger resume
└── lib/ai/agents/explorer/
    └── graph.ts                # runExplorerGraph: handle resume mode
```

---

## Step-by-Step Implementation

### Step 1: Update `runExplorerGraph` for resume support

Modify `runExplorerGraph` to:
1. Accept optional `resumeFrom` state parameter
2. On async tool (status=0), store state in `FetchTask` as JSON for later resume
3. Return state with `waitingForExtensionResult: true` when hanging

### Step 2: Update `/explorer/tasks/pickup`

After marking task as "exploring", call `runExplorerGraphAsync()` (fire-and-forget). Don't wait for completion — the graph will return when it needs extension results.

### Step 3: Update `/explorer/tasks/process`

Change from calling `explore()` to calling `runExplorerGraph()`. After each invocation, check if result has `waitingForExtensionResult: true` — if so, return immediately (don't block). If terminal, save result to FetchTask.

### Step 4: Update `/agent/results` POST

After processing result (existing FetchTask update), check if there's a hanging AgentStateLog. If so, re-invoke `runExplorerGraph` with the saved state.

### Step 5: Update `/agent/commands` GET (minor)

The existing logic already returns commands based on `currentAction`/`currentTarget` in FetchTask. When LangGraph agent queues a command, it stores `currentAction`/`currentTarget` via the extension tool's `postCommand`. So this should work as-is.

---

## References

- Iteration 10: `@context/features/explorer-agent-10-ai-agent-integration-spec.md`
- `runExplorerGraph()`: `src/lib/ai/agents/explorer/graph.ts`
- `ChromeExtensionTool.postCommand()`: `src/lib/ai/agents/explorer/tools/chrome-extension.ts`
- `getResumeContext()`: `src/lib/ai/state-log.ts`

---

## Notes

- The LangGraph state IS the checkpoint — no need for separate state serialization
- The extension never talks directly to the LangGraph agent — it only talks to Commands/Results APIs (same as before)
- `runExplorerGraph` returns when: (a) terminal reached, (b) async tool queued (waitingForExtensionResult)
- On resume, caller re-invokes `runExplorerGraph` with the returned state
- `agentType` field on FetchTask distinguishes new vs old flow (optional, for gradual migration)