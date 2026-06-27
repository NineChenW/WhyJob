# Explorer Agent - Checkpointer + Interrupt (Iteration 12)

## Overview

Replace manual state log reading/writing with LangGraph's built-in `PostgresSaver` checkpointer. Use `interrupt()` to cleanly pause when async tools are waiting for extension results. When resumed, the node detects the pending call and completes it using the resume value.

**Key improvements:**
1. **Per-node checkpointing** — state is persisted after every node completes (not just on interrupt)
2. **Crash recovery** — if process crashes between nodes, resume from last checkpoint
3. **Granular resume** — resume from any node boundary, not just after entire loop iteration
4. **Remove all `AgentStateLog` dependencies** — checkpointer handles everything

**Installation + changes:**
1. Add `@langchain/langgraph-checkpoint-postgres` dependency
2. Create `checkpointer.ts` with `PostgresSaver` setup
3. Compile graph with checkpointer
4. Use `interrupt()` in `executeToolNode` for async pause
5. Remove `createStateLog()` calls from all nodes
6. Remove `getResumeContext()` from `runExplorerGraph()`

---

## Key Concepts

### How `interrupt()` Works in LangGraph.js

```typescript
import { interrupt, Command } from '@langchain/langgraph';

// Inside a node:
const result = interrupt({ requestId: 'abc', tool: 'NAVIGATE' });
// First invoke: graph pauses, result is NEVER used (code after this doesn't run)
// Resume invoke: result = whatever was passed to Command({ resume: ... })
return { toolCalls: updatedToolCalls };
```

### Checkpointing Behavior

**Important**: The `PostgresSaver` checkpointer checkpointes state **after every node completes**, not just on `interrupt()`. This provides:

| Event | Checkpoint Saved? |
|-------|------------------|
| Node completes | ✅ Yes — state saved after each node |
| Edge transition | ✅ Yes |
| `interrupt()` called | ✅ Yes + execution pauses |
| Process crashes between nodes | ✅ Yes — safe to resume |

**Benefits over manual `AgentStateLog`:**
- No `createStateLog()` calls needed in any node
- State is saved after **every** node, not just critical ones
- Resume point is more granular (per-node vs per-entire-loop)
- Crash recovery is automatic

### Resume Flow

1. **First `graph.invoke()`** → hits `interrupt()` → pauses, returns `__interrupt__` with payload
2. Extension polls `/commands` → executes → POST `/results`
3. Results API calls `graph.invoke(new Command({ resume: resultData }), config)`
4. **Second `graph.invoke()`** → `interrupt()` returns `resultData` → node continues

---

## Architecture

### Current Flow (Iteration 11)

```
Pickup → runExplorerGraph() → execute_tool queues command
         ↓
         [State saved manually to AgentStateLog]
         ↓
         returns with waitingForExtensionResult=true
         ↓
Extension polls GET /commands → executes → POST /results
         ↓
         [Results API updates AgentStateLog status=1]
         ↓
Process endpoint calls getResumeContext() → re-invokes runExplorerGraph()
```

**Problems:**
- Manual state serialization/deserialization in every node
- `getResumeContext()` called at start of every `runExplorerGraph()` call
- No clean way to "pause" graph — using state flags + early return
- Redundant persistence: AgentStateLog + FetchTask fields

### New Flow (Iteration 12)

```
Pickup → runExplorerGraph() → execute_tool saves pending tool in state
                                    ↓
                                interrupt() → graph pauses (state persisted to Postgres)
                                    ↓
                                returns { __interrupt__: [...] }

Commands GET → compiled.getState(thread_id) → reads pending tool from state
Extension executes → POST /results

Results API: compiled.invoke(Command({ resume: { data, error } }), config)
                                    ↓
                                interrupt() returns resume value
                                    ↓
                                execute_tool completes pending call
                                    ↓
                                observe_result → reflect → llm_decision → ...

...continue until terminal state
```

**Key change**: Commands GET reads from **graph state** (checkpointed in Postgres via `compiled.getState()`), not from `FetchTask.currentAction`. The pending tool parameters are already in the state after `interrupt()`.

---

## Files to Modify/Add

```
Modified:
- package.json                                      (add @langchain/langgraph-checkpoint-postgres)
- src/lib/ai/agents/explorer/graph.ts               (compile with checkpointer, remove getResumeContext)
- src/lib/ai/agents/explorer/nodes/execute-tool.ts  (use interrupt(), remove createStateLog, remove postCommand, remove FetchTask updates)
- src/lib/ai/agents/explorer/nodes/observe-result.ts (remove createStateLog)
- src/lib/ai/agents/explorer/nodes/reflect.ts       (remove createStateLog)
- src/lib/ai/agents/explorer/nodes/llm-decision.ts  (remove createStateLog)
- src/lib/ai/agents/explorer/nodes/check-termination.ts (remove createStateLog)
- src/lib/ai/agents/explorer/nodes/generate-config.ts  (remove createStateLog)
- src/lib/ai/agents/explorer/nodes/test-config.ts  (remove createStateLog)
- src/lib/ai/agents/explorer/nodes/index.ts         (may need updates for new node signatures)
- src/app/api/explorer/tasks/pickup/route.ts        (no changes needed)
- src/app/api/explorer/tasks/process/route.ts       (simplified - just check completion)
- src/app/api/agent/results/route.ts               (use Command({ resume }) to resume)
- src/app/api/agent/commands/route.ts              (reads from graph state via getState, removes FetchTask queries)

Added:
- src/lib/ai/agents/explorer/checkpointer.ts       (PostgresSaver setup + config helper)

Removed:
- All createStateLog() calls from all nodes — PostgresSaver checkpointes after every node

---

## Implementation Details

### 1. Checkpointer Setup

**File: `src/lib/ai/agents/explorer/checkpointer.ts`**

```typescript
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

let _saver: PostgresSaver | null = null;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (_saver) return _saver;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');

  _saver = PostgresSaver.fromConnString(dbUrl);
  await _saver.setup(); // Creates checkpoint tables on first run
  return _saver;
}

export function createThreadConfig(taskId: string) {
  return {
    configurable: {
      thread_id: taskId,
    },
  };
}
```

### 2. Graph Compilation

**File: `src/lib/ai/agents/explorer/graph.ts`**

```typescript
import { getCheckpointer, createThreadConfig } from './checkpointer';

export function createExplorerGraph(checkpointer?: PostgresSaver) {
  // ... existing node setup (unchanged) ...
  return graph.compile({ checkpointer });
}

export async function runExplorerGraph(
  state: ExplorationState,
  serverUrl: string
): Promise<ExplorationState> {
  const { ChromeExtensionTool } = require('./tools/chrome-extension');

  const checkpointer = await getCheckpointer();
  const graph = createExplorerGraph(checkpointer);
  const compiled = graph.compile();

  const tool = new ChromeExtensionTool(serverUrl, state.taskId);
  const config = createThreadConfig(state.taskId);  // thread_id = taskId

  // No getResumeContext() needed - checkpointer persists state automatically
  // If this task was previously interrupted, LangGraph will load that checkpoint
  const result = await compiled.invoke(state, {
    configurable: { tool },
    ...config,
  });

  return result as ExplorationState;
}
```

**Key points:**
- `thread_id = state.taskId` — same thread_id used for initial invoke and resume
- If task was previously interrupted, checkpoint is auto-loaded by thread_id
- `getResumeContext()` no longer needed — checkpointer handles all state retrieval

### 3. Execute Tool Node with Interrupt

**File: `src/lib/ai/agents/explorer/nodes/execute-tool.ts`**

```typescript
import { interrupt } from '@langchain/langgraph';

export async function executeToolNode(
  state: ExplorationState,
  config?: NodeConfig
): Promise<Partial<ExplorationState>> {
  const { currentDecision, iteration } = state;

  if (!currentDecision) {
    throw new Error('No current decision - cannot execute tool');
  }

  if (TERMINAL_ACTIONS.includes(currentDecision.action as typeof TERMINAL_ACTIONS[number])) {
    return {};
  }

  const tool = config?.configurable?.tool;
  if (!tool) {
    return {
      errors: [...state.errors, { iteration, tool: currentDecision.action, error: 'Chrome Extension tool not configured', timestamp: new Date() }],
    };
  }

  const toolInput = buildToolInput(currentDecision);
  const isAsyncTool = !['TEST_API'].includes(currentDecision.action);

  if (isAsyncTool) {
    return handleAsyncToolWithInterrupt(state, tool, currentDecision, iteration, toolInput);
  } else {
    return handleSyncTool(state, tool, toolInput);
  }
}

async function handleAsyncToolWithInterrupt(
  state: ExplorationState,
  tool: ChromeExtensionTool,
  decision: LLMSDecision,
  iteration: number,
  toolInput: Record<string, unknown>
): Promise<Partial<ExplorationState>> {
  const { taskId } = state;

  // Check if there's a pending tool call from a previous interrupt (resume case)
  const lastCall = state.toolCalls[state.toolCalls.length - 1];

  if (lastCall?.status === 'pending') {
    // This is a resume - interrupt() returns the resume value
    const resumeData = interrupt({
      requestId: lastCall.requestId,
      tool: decision.action,
      waitingForResult: true,
    });

    if (resumeData) {
      // Resume with result - complete the pending call
      const completedCall: ToolCall = {
        ...lastCall,
        output: resumeData.data,
        error: resumeData.error,
        status: 'completed',
      };

      return {
        toolCalls: [...state.toolCalls.slice(0, -1), completedCall],
      };
    }
  }

  // First run: build pending tool call and save to state, then interrupt to pause
  const startTime = Date.now();
  const requestId = `${taskId}-${iteration}-${Date.now()}`;

  // Build the pending tool call with all parameters needed by extension
  const toolCall: ToolCall = {
    tool: decision.action,
    input: toolInput,           // The invoke parameters (url, selectors, script, etc.)
    output: undefined,
    error: undefined,
    timestamp: new Date(),
    duration: Date.now() - startTime,
    requestId,                 // Unique ID for this call (used by extension to post result)
    status: 'pending',
  };

  // Return state update with pending tool call
  // PostgresSaver checkpointer auto-saves state AFTER node returns
  // Then interrupt() pauses the graph (interrupt throws internally)
  interrupt({
    requestId,
    tool: decision.action,
    waitingForResult: true,
  });

  // This line never runs - interrupt() throws and pauses the graph
  return { toolCalls: [...state.toolCalls, toolCall] };
}
```

**Key execution order:**
1. Build `toolCall` with pending status and invoke parameters
2. `return { toolCalls: [...] }` — node returns, PostgresSaver saves state
3. `interrupt()` — throws internally, graph pauses, checkpoint saved
4. Extension polls Commands GET → reads pending tool from checkpointed state
5. Extension POSTs result → Results API calls `Command({ resume })`
6. Graph resumes, `interrupt()` returns resume value, pending call completed

**Key changes:**
1. **No `tool.postCommand()`** — extension polls Commands GET instead of receiving push
2. **No `FetchTask.update()`** — Commands GET reads from graph state, not FetchTask
3. **Tool call saved in state** — `requestId`, `input` (params), `tool`, all in state for Commands GET to read
4. **Checkpointer handles persistence** — PostgresSaver saves state after node completes

### 4. Results API Resume

**File: `src/app/api/agent/results/route.ts` (POST handler)**

```typescript
import { Command } from '@langchain/langgraph';
import { getCheckpointer, createThreadConfig } from '@/lib/ai/agents/explorer/checkpointer';
import { createExplorerGraph } from '@/lib/ai/agents/explorer/graph';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { results } = body;
  const result = results[0];

  // Extract taskId from requestId (format: "taskId-iteration-timestamp")
  // This is used as thread_id to resume the correct checkpoint
  const requestIdParts = result.requestId.split('-');
  const taskId = requestIdParts.slice(0, -2).join('-');

  try {
    // Get checkpointer and resume graph
    const checkpointer = await getCheckpointer();
    const graph = createExplorerGraph(checkpointer);
    const compiled = graph.compile();
    const config = createThreadConfig(taskId);  // thread_id = taskId

    // Resume the graph with the result
    // LangGraph loads checkpoint by thread_id, then continues from interrupt
    const resumedState = await compiled.invoke(
      new Command({
        resume: {
          success: result.success,
          data: result.data,
          error: result.error,
        },
      }),
      config
    );

    // If graph completed (no more interrupts), handle terminal state
    if (resumedState.terminationReason) {
      if (resumedState.terminationReason === 'generate_config' && resumedState.finalResult) {
        await completeFetchTask(taskId, resumedState.finalResult.config, resumedState.finalResult.confidence);
      } else {
        await failFetchTask(taskId, resumedState.finalResult?.reason ?? resumedState.terminationReason);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resuming graph:', error);
    return NextResponse.json({ error: 'Failed to resume' }, { status: 500 });
  }
}
```

### 5. Process Endpoint (Simplified)

**File: `src/app/api/explorer/tasks/process/route.ts`**

```typescript
// POST /api/explorer/tasks/process
// Just checks status - actual resume happens via Results API
export async function POST(request: NextRequest) {
  const { taskId } = await request.json();

  const task = await prisma.fetchTask.findUnique({ where: { id: taskId } });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (task.status === 'complete') {
    return NextResponse.json({
      processed: true,
      success: true,
      config: task.config,
      confidence: task.confidence,
    });
  }

  if (task.status === 'failed') {
    return NextResponse.json({
      processed: true,
      success: false,
      reason: task.reason,
    });
  }

  // Still exploring - return waiting status
  // The extension will poll Commands GET
  return NextResponse.json({
    processed: true,
    waitingForExtension: true,
    taskId: task.id,
  });
}
```

### 6. Commands GET (Updated)

**File: `src/app/api/agent/commands/route.ts` (GET handler)**

```typescript
import { getCheckpointer, createThreadConfig } from '@/lib/ai/agents/explorer/checkpointer';
import { createExplorerGraph } from '@/lib/ai/agents/explorer/graph';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const extensionId = searchParams.get('extensionId');
  const taskId = searchParams.get('taskId');

  if (!extensionId || !taskId) {
    return NextResponse.json({ error: 'extensionId and taskId required' }, { status: 400 });
  }

  try {
    // Read pending tool from graph state (checkpointed in Postgres)
    const checkpointer = await getCheckpointer();
    const graph = createExplorerGraph(checkpointer);
    const compiled = graph.compile();
    const config = createThreadConfig(taskId);

    const state = await compiled.getState(config);

    // Find pending tool call from checkpointed state
    const toolCalls = state.values.toolCalls as ToolCall[] | undefined;
    const lastCall = toolCalls?.[toolCalls.length - 1];

    if (lastCall?.status === 'pending') {
      return NextResponse.json({
        commands: [{
          action: lastCall.tool,
          requestId: lastCall.requestId,
          params: lastCall.input,
          url: (lastCall.input as { url?: string })?.url,
        }],
        taskStatus: 'exploring',
        iteration: state.values.iteration,
      });
    }

    // No pending tool - graph is either still running or completed
    return NextResponse.json({
      commands: [],
      taskStatus: state.next?.length > 0 ? 'exploring' : 'complete',
      message: 'No pending command',
    });
  } catch (error) {
    console.error('Error getting commands:', error);
    return NextResponse.json({ error: 'Failed to get commands' }, { status: 500 });
  }
}
```

**Key change**: Commands GET now reads from **graph state** via `compiled.getState()`, not from `FetchTask.currentAction`. The pending tool parameters (`action`, `requestId`, `input`) are in the checkpointed state after `interrupt()`.

---

## Thread ID Management

**Critical**: The same `thread_id` must be used for initial invoke and resume. This is how LangGraph knows which checkpointed state to load.

### Thread ID Lifecycle

```
1. PICKUP
   └─→ runExplorerGraph(state, serverUrl)
       └─→ const config = { configurable: { thread_id: state.taskId, ... } }
           └─→ compiled.invoke(state, config)
               └─→ interrupt() called → state checkpointed under thread_id=taskId

2. EXTENSION polls /commands
   └─→ compiled.getState(config) → reads pending tool from checkpointed state
       └─→ Returns pending tool (action, requestId, params) to extension

3. EXTENSION executes → POST /results
   └─→ Results API extracts taskId from requestId
       └─→ const config = { configurable: { thread_id: taskId } }
           └─→ compiled.invoke(Command({ resume: data }), config)
               └─→ LangGraph loads checkpoint by thread_id → resumes
```

### How thread_id is determined

**We use `taskId` as the `thread_id`** because:
1. It's unique per exploration task
2. It's already available in the state
3. Results API can extract it from `requestId` (format: `taskId-iteration-timestamp`)

### Key Implementation Details

```typescript
// In checkpointer.ts
export function createThreadConfig(taskId: string) {
  return {
    configurable: {
      thread_id: taskId,  // Same thread_id for all invokes of this task
    },
  };
}
```

```typescript
// In runExplorerGraph (initial invoke)
const config = createThreadConfig(state.taskId);
const result = await compiled.invoke(state, { configurable: { tool }, ...config });

// In Results API (resume)
const requestIdParts = result.requestId.split('-');
const taskId = requestIdParts.slice(0, -2).join('-');  // Extract taskId
const config = createThreadConfig(taskId);             // Same thread_id
const resumedState = await compiled.invoke(new Command({ resume: data }), config);
```

### Why thread_id matters

If you used a different `thread_id` on resume, LangGraph would:
1. Not find any checkpoint for that thread_id
2. Start fresh (not resume from interrupt point)

This is why `createThreadConfig()` is a shared helper — it ensures consistent `thread_id` across all graph invocations for the same task.

---

## Flow Diagram

```
1. PICKUP
   └─→ runExplorerGraph(task) → execute_tool queues command
                                    ↓
                                interrupt() → graph pauses (state persisted to Postgres via checkpointer)
                                    ↓
                                returns { __interrupt__: [{ value: { requestId, tool } }] }

2. EXTENSION POLLS /commands
   └─→ Returns currentAction/currentTarget from FetchTask

3. EXTENSION EXECUTES → POST /results
   └─→ Results API: compiled.invoke(Command({ resume: { data, error } }), config)
                                    ↓
                                interrupt() returns resume value
                                    ↓
                                execute_tool completes pending call
                                    ↓
                                observe_result → reflect → llm_decision → ...

4. GRAPH CONTINUES until terminal state (generate_config, fail, max_iterations)
```

---

## Summary of Changes

| Aspect | Before (Iteration 11) | After (Iteration 12) |
|--------|----------------------|----------------------|
| State persistence | Manual `createStateLog()` in each node | Automatic via `PostgresSaver` after **every node** |
| Resume mechanism | `getResumeContext()` + re-invoke `runExplorerGraph()` | `Command({ resume })` auto-resumes from checkpoint |
| Async pause | Return early with `waitingForExtensionResult=true` | `interrupt()` cleanly pauses |
| Commands GET | Reads from `FetchTask.currentAction` | Reads from graph state via `compiled.getState()` |
| Command queue | `tool.postCommand()` pushes to extension | Extension polls Commands GET (pull model) |
| FetchTask updates | `currentAction`/`currentTarget` updated in nodes | **No longer needed** - state is source of truth |
| External state | `AgentStateLog` table required | Table exists but not used by graph |

---

## What Stays the Same

- `FetchTask` table — still exists but **only for tracking task status** (`pending`, `exploring`, `complete`, `failed`), not for command data
- `AgentStateLog` table — still exists in DB but graph does NOT read/write it
- Extension polling pattern — extension still polls Commands GET, but now reads from graph state

---

## Installation

```bash
npm install @langchain/langgraph-checkpoint-postgres
```

---

## Database Tables Created by PostgresSaver

The `checkpointer.setup()` creates:
- `checkpoints` — stores graph state per thread_id
- `checkpoint_writes` — intermediate writes

**No changes to existing schema needed.**

---

## References

- LangGraph Checkpointers: `@langchain/langgraph-checkpoint-postgres`
- `interrupt()` API: https://docs.langchain.com/oss/javascript/langgraph/interrupts
- `Command` resume: https://docs.langchain.com/oss/javascript/langgraph/graph-api

---

## History

- **2026-06-22**: Explorer Agent - Checkpointer + Interrupt (Iteration 12) - Add PostgresSaver checkpointer, use interrupt() for async pause/resume, remove all AgentStateLog dependencies, rely purely on checkpointer for state persistence.