# Explorer Agent - AI Agent Integration Spec

## Overview

This spec defines how the **LangGraph-based AI Agent** (Explorer Agent) integrates with the **Chrome Extension** via HTTP polling. The existing `explorer-act.ts` provides the HTTP polling infrastructure; this spec extends it to support the full ReAct loop with LangGraph.

**Key distinction from existing pattern:**
- `explorer-act.ts` — Rule-based decision making (no AI)
- `explorer-graph.ts` (this spec) — AI-powered ReAct decisions via LangGraph + NVIDIA NIM

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LangGraph Explorer Agent                             │
│                                                                              │
│   State: taskId, company, iterations, discoveries, reactTrace, etc.       │
│                                                                              │
│   Nodes:                                                                    │
│   - llm_decision      → Calls NVIDIA for next ReAct action                  │
│   - check_termination → Checks for GENERATE_CONFIG / FAIL / max_iterations   │
│   - execute_tool      → Executes tools (sync or async)                     │
│   - observe_result    → Parses discoveries from tool output                  │
│   - reflect           → Updates confidence based on observation              │
│   - generate_config   → Builds FetchConfig from discoveries                  │
│   - test_config       → Tests generated FetchConfig via HTTP                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP POST/GET
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Routes                                        │
│                                                                              │
│   POST /api/agent/commands    → Queue commands for extension               │
│   GET  /api/agent/commands    → Extension polls for commands               │
│   POST /api/agent/results     → Extension posts execution results           │
│   GET  /api/agent/results     → Agent polls for results                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP Polling (Extension ↔ Browser)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Chrome Extension                                    │
│                                                                              │
│   - Receives commands via polling                                           │
│   - Executes NAVIGATE, GET_SNAPSHOT, EXTRACT_DOM, etc.                     │
│   - Posts results back to server                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent ↔ Server ↔ Extension Interactive Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Agent ↔ Server ↔ Extension                        │
└─────────────────────────────────────────────────────────────────────────────┘

Agent                            Server                          Extension
  │                                │                                 │
  │  1. POST /api/agent/commands   │                                 │
  │     (taskId, commands[])       │                                 │
  │ ──────────────────────────────►│                                 │
  │                                │                                 │
  │                                │  2. GET /api/agent/commands     │
  │                                │     (extensionId, taskId)     │
  │                                │◄──────────────────────────────── │
  │                                │     { commands: [...] }         │
  │                                │                                 │
  │                                │  3. Execute in browser         │
  │                                │                                 │
  │                                │  4. POST /api/agent/results     │
  │                                │     (extensionId, results[])   │
  │                                │◄──────────────────────────────── │
  │                                │                                 │
  │  5. GET /api/agent/results    │                                 │
  │     (taskId, requestId)       │                                 │
  │ ──────────────────────────────►│                                 │
  │     { result }                 │                                 │
  │                                │                                 │
```

**Flow Steps:**
1. Agent POSTs command to server (e.g., NAVIGATE, GET_SNAPSHOT)
2. Server queues command, Extension polls GET /api/agent/commands
3. Extension receives command, executes in browser
4. Extension POSTs result back to server
5. Agent GETs result from server (via execute_tool node)

---

## State Log Table

For incremental state persistence with async tool support.

### Database Schema

```prisma
// prisma/schema.prisma

model AgentStateLog {
  id        String   @id @default(cuid())
  taskId    String   // Task being executed
  agent     String   // Agent name (e.g., "explorer", "resume", "interview")
  node      String   // Node name (e.g., "llm_decision", "execute_tool")
  state     Json     // Full state snapshot at this point
  note      Json?    // Additional notes (decision reasoning, errors, etc.)
  nextNode  String?  // Next node to execute (null if current is terminal)
  status    Int      @default(1)  // 1=Done, 0=Hang up waiting for async

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([taskId, createdAt])
  @@index([agent, taskId])
  @@index([taskId, status])  // Find hanging tasks
}
```

### Note Schema

```typescript
interface StateLogNote {
  // Common fields
  iteration?: number;
  error?: string;
  duration?: number; // ms

  // LLM decision fields
  decision?: {
    action: string;
    target?: unknown;
    reasoning: string;
    confidence: number;
  };
  reasoning?: string;

  // Tool execution fields
  toolCall?: {
    tool: string;
    input: unknown;
    output?: unknown;
    error?: string;
  };

  // Async tool fields
  asyncTool?: {
    toolName: string;
    requestId: string;
    commandQueued: boolean;
    waitingForResult: boolean;
  };

  // Discovery fields
  discoveriesAdded?: number;
  pagesVisitedCount?: number;
  networkCallsCount?: number;

  // Config test fields
  configTest?: {
    success: boolean;
    statusCode?: number;
    itemCount?: number;
    responseTime?: number;
    error?: string;
  };

  // Termination fields
  terminationReason?: string;
  shouldContinue?: boolean;

  // Metadata
  metadata?: Record<string, unknown>;
}
```

### Generic State Log Functions

```typescript
// src/lib/ai/state-log.ts

import { prisma } from '@/lib/prisma';

export interface StateLogInput {
  taskId: string;
  agent: string;
  node: string;
  state: unknown;
  note?: StateLogNote;
  nextNode?: string | null;
  status?: 0 | 1; // 1=Done, 0=Hang up
}

/**
 * Create a new state log entry
 */
export async function createStateLog(input: StateLogInput): Promise<string> {
  const log = await prisma.agentStateLog.create({
    data: {
      taskId: input.taskId,
      agent: input.agent,
      node: input.node,
      state: input.state as object,
      note: input.note ? (input.note as object) : undefined,
      nextNode: input.nextNode ?? null,
      status: input.status ?? 1,
    },
  });
  return log.id;
}

/**
 * Update state log (for async resume)
 */
export async function updateStateLog(
  id: string,
  updates: Partial<{
    state: unknown;
    note: StateLogNote;
    nextNode: string | null;
    status: 0 | 1;
  }>
): Promise<void> {
  await prisma.agentStateLog.update({
    where: { id },
    data: {
      ...updates,
      note: updates.note ? (updates.note as object) : undefined,
      state: updates.state ? (updates.state as object) : undefined,
    },
  });
}

/**
 * Get latest log entry for a task
 */
export async function getLatestStateLog(taskId: string): Promise<AgentStateLog | null> {
  return prisma.agentStateLog.findFirst({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get hanging log entries for a task (status = 0)
 */
export async function getHangingLogs(taskId: string): Promise<AgentStateLog[]> {
  return prisma.agentStateLog.findMany({
    where: { taskId, status: 0 },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Resume from hanging state
 */
export async function getResumeContext(taskId: string): Promise<{
  log: AgentStateLog;
  state: unknown;
} | null> {
  const log = await prisma.agentStateLog.findFirst({
    where: { taskId, status: 0 },
    orderBy: { createdAt: 'desc' },
  });

  if (!log) return null;

  return {
    log,
    state: log.state as unknown,
  };
}

/**
 * Clear state logs for a task
 */
export async function clearStateLogs(taskId: string): Promise<number> {
  const result = await prisma.agentStateLog.deleteMany({
    where: { taskId },
  });
  return result.count;
}
```

---

## Async Tool Pattern (execute_tool only)

Only the `execute_tool` node handles async tools. Other nodes are synchronous.

### Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    execute_tool Node - Async Flow                           │
└─────────────────────────────────────────────────────────────────────────────┘

SYNC TOOL (e.g., TEST_API):
  1. Build tool input
  2. Execute tool directly
  3. Return result immediately
  4. Log state with status=1 (Done)

ASYNC TOOL (e.g., NAVIGATE, GET_SNAPSHOT):
  1. Build command from currentDecision
  2. POST command to /api/agent/commands (queue for extension)
  3. Log state with status=0 (Hang up), nextNode='execute_tool'
  4. RETURN EARLY (node "hangs")

  ... (process returns to caller, extension polls and executes) ...

  5. Extension POSTs result to /api/agent/results
  6. Results API detects hanging task, triggers resume
  7. execute_tool resumes with the result
  8. Log state with status=1 (Done), clear nextNode
  9. Continue to observe_result
```

### execute_tool Implementation

```typescript
// src/lib/ai/agents/explorer/nodes/execute-tool.ts

import { createStateLog, updateStateLog, getLatestStateLog } from '@/lib/ai/state-log';
import type { ExplorationState } from '../types';

const AGENT_NAME = 'explorer';

export async function executeToolNode(
  state: ExplorationState,
  context: { tool: ChromeExtensionTool }
): Promise<Partial<ExplorationState>> {
  const { currentDecision, iteration, taskId } = state;

  // Skip terminal actions
  if (currentDecision?.action === 'GENERATE_CONFIG' || currentDecision?.action === 'FAIL') {
    return {};
  }

  // Determine if tool is async (requires extension) or sync (executes directly)
  const isAsyncTool = !['TEST_API'].includes(currentDecision?.action ?? '');

  if (isAsyncTool) {
    return handleAsyncTool(state, context);
  } else {
    return handleSyncTool(state, context);
  }
}

async function handleAsyncTool(
  state: ExplorationState,
  context: { tool: ChromeExtensionTool }
): Promise<Partial<ExplorationState>> {
  const { currentDecision, iteration, taskId } = state;
  const startTime = Date.now();
  const requestId = `${taskId}-${iteration}-${Date.now()}`;

  // Build tool input
  const toolInput = buildToolInput(currentDecision);

  // Post command to queue for extension
  await context.tool.postCommand({
    type: currentDecision!.action,
    requestId,
    params: toolInput,
  });

  // Log state with status=0 (Hang up)
  await createStateLog({
    taskId,
    agent: AGENT_NAME,
    node: 'execute_tool',
    state: {
      iteration,
      currentDecision,
      toolCalls: state.toolCalls,
      errors: state.errors,
    },
    note: {
      iteration,
      toolCall: {
        tool: currentDecision!.action,
        input: toolInput,
      },
      asyncTool: {
        toolName: currentDecision!.action,
        requestId,
        commandQueued: true,
        waitingForResult: true,
      },
      duration: Date.now() - startTime,
    },
    nextNode: 'execute_tool',  // Resume this node
    status: 0,  // Hang up
  });

  // Return early - node hangs until extension posts result
  return {
    toolCalls: [...state.toolCalls, {
      tool: currentDecision!.action,
      input: toolInput,
      output: undefined,
      error: undefined,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      requestId,
      status: 'pending',
    }],
  };
}

async function handleSyncTool(
  state: ExplorationState,
  context: { tool: ChromeExtensionTool }
): Promise<Partial<ExplorationState>> {
  const { currentDecision, iteration, taskId } = state;
  const startTime = Date.now();

  const toolInput = buildToolInput(currentDecision);

  let output: unknown;
  let error: string | undefined;

  try {
    // TEST_API executes directly without extension
    output = await context.tool.invoke({
      action: currentDecision!.action,
      params: toolInput,
    });
  } catch (e) {
    error = String(e);
  }

  const duration = Date.now() - startTime;

  const result = {
    toolCalls: [...state.toolCalls, {
      tool: currentDecision!.action,
      input: toolInput,
      output,
      error,
      timestamp: new Date(),
      duration,
    }],
    errors: error
      ? [...state.errors, { iteration, tool: currentDecision!.action, error, timestamp: new Date() }]
      : state.errors,
  };

  // Log state with status=1 (Done)
  await createStateLog({
    taskId,
    agent: AGENT_NAME,
    node: 'execute_tool',
    state,
    note: {
      iteration,
      toolCall: {
        tool: currentDecision!.action,
        input: toolInput,
        output,
        error,
      },
      duration,
    },
    nextNode: 'observe_result',
    status: 1,
  });

  return result;
}
```

### Resume Logic (Results API)

```typescript
// src/app/api/agent/results/route.ts

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { results, extensionId } = body;

  // ... existing result processing ...

  // After processing results, check if any tasks were hanging
  for (const result of results) {
    const requestIdParts = result.requestId.split('-');
    const taskId = requestIdParts.slice(0, -1).join('-');

    // Find hanging log for this task
    const hangingLog = await getLatestStateLog(taskId);

    if (hangingLog && hangingLog.status === 0) {
      // Resume the hanging node
      console.log(`[Results] Resuming hanging task: ${taskId}, node: ${hangingLog.node}`);

      // Update the log with result and set status=1
      await updateStateLog(hangingLog.id, {
        status: 1,
        nextNode: 'observe_result',
        note: {
          ...(hangingLog.note as StateLogNote),
          toolCall: {
            ...((hangingLog.note as StateLogNote)?.toolCall as object || {}),
            output: result.data,
            error: result.error,
          },
          asyncTool: {
            ...((hangingLog.note as StateLogNote)?.asyncTool as object || {}),
            waitingForResult: false,
          },
        },
      });

      // Trigger resume by enqueueing task for processing
      await enqueueTaskResume(taskId);
    }
  }

  return NextResponse.json({ success: true });
}
```

---

## Other Nodes (Synchronous)

All other nodes are synchronous and don't need async adoption:

```typescript
// llm_decision - synchronous AI call
async function llmDecisionNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const result = await llmCall(state);

  await createStateLog({
    taskId: state.taskId,
    agent: 'explorer',
    node: 'llm_decision',
    state: result,
    note: { iteration: state.iteration, decision: result.currentDecision },
    nextNode: 'check_termination',
    status: 1,
  });

  return result;
}

// check_termination - pure logic
async function checkTerminationNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  // ... logic ...
  const nextNode = state.shouldContinue ? 'execute_tool' : 'generate_config';

  await createStateLog({
    taskId: state.taskId,
    agent: 'explorer',
    node: 'check_termination',
    state: result,
    note: { terminationReason: result.terminationReason, shouldContinue: result.shouldContinue },
    nextNode,
    status: 1,
  });

  return result;
}

// observe_result - synchronous parsing
// reflect - synchronous
// generate_config - synchronous
// test_config - synchronous
```

---

## Graph Definition

```typescript
// src/lib/ai/agents/explorer/graph.ts

export function createExplorerGraph() {
  const graph = new StateGraph({ annotation: ExplorationAnnotation });

  // Add nodes
  graph.addNode('llm_decision', llmDecisionNode);
  graph.addNode('check_termination', checkTerminationNode);
  graph.addNode('execute_tool', executeToolNode);
  graph.addNode('observe_result', observeResultNode);
  graph.addNode('reflect', reflectNode);
  graph.addNode('generate_config', generateConfigNode);
  graph.addNode('test_config', testConfigNode);

  // Edges
  graph.addEdge(START, 'llm_decision');
  graph.addEdge('llm_decision', 'check_termination');

  // Conditional routing
  graph.addConditionalEdges(
    'check_termination',
    (state) => state.terminationReason ?? 'execute_tool',
    {
      execute_tool: 'execute_tool',
      generate_config: 'generate_config',
      fail: END,
      max_iterations: 'generate_config',
    }
  );

  // Normal flow: tool → observe → reflect → loop back
  graph.addEdge('execute_tool', 'observe_result');
  graph.addEdge('observe_result', 'reflect');
  graph.addEdge('reflect', 'llm_decision');

  // Terminal flow: generate_config → test_config → end
  graph.addEdge('generate_config', 'test_config');
  graph.addEdge('test_config', END);

  return graph;
}
```

### Resume Flow (Hanging Task)

```
Extension posts result → Results API → detect hanging log
                                        ↓
                               Update log status=1, nextNode
                                        ↓
                               Enqueue task for processing
                                        ↓
                               Re-invoke graph with saved state
                                        ↓
                               execute_tool resumes (status=0 entry found)
                                        ↓
                               Continue to observe_result → reflect → ...
```

---

## File Structure

```
src/
├── lib/
│   ├── ai/
│   │   ├── state-log.ts                    # Generic state logging
│   │   └── agents/
│   │       └── explorer/
│   │           ├── graph.ts                # LangGraph StateGraph
│   │           ├── nodes/
│   │           │   ├── llm-decision.ts     # AI decision (sync)
│   │           │   ├── check-termination.ts # Termination check (sync)
│   │           │   ├── execute-tool.ts      # Tool execution (async aware)
│   │           │   ├── observe-result.ts    # Result parsing (sync)
│   │           │   ├── reflect.ts           # Reflection (sync)
│   │           │   ├── generate-config.ts   # Config generation (sync)
│   │           │   ├── test-config.ts       # Config testing (sync)
│   │           │   └── index.ts
│   │           └── tools/
│   │               └── chrome-extension.ts  # Chrome Extension tool
│   └── fetch/
│       └── config-tester.ts                # FetchConfig testing
└── app/api/agent/
    ├── commands/route.ts
    └── results/route.ts                     # Resume trigger on async result
```

---

## Test Config Node (NEW)

```typescript
// src/lib/ai/agents/explorer/nodes/test-config.ts

import { testFetchConfig } from '@/lib/fetch';
import { createStateLog } from '@/lib/ai/state-log';

export async function testConfigNode(
  state: ExplorationState
): Promise<Partial<ExplorationState>> {
  const { finalResult, taskId } = state;

  if (!finalResult?.config) {
    await createStateLog({
      taskId,
      agent: 'explorer',
      node: 'test_config',
      state: { finalResult },
      note: { error: 'No config to test' },
      status: 1,
    });
    return { finalResult: { ...finalResult, status: 'failed' } };
  }

  const testResult = await testFetchConfig(finalResult.config, {
    timeout: 15000,
    maxItems: 5,
  });

  const configValid = testResult.success && (testResult.itemCount ?? 0) > 0;
  const finalConfidence = configValid
    ? Math.min(100, finalResult.confidence + 10)
    : Math.max(0, finalResult.confidence - 30);

  await createStateLog({
    taskId,
    agent: 'explorer',
    node: 'test_config',
    state: { finalResult, configValid, finalConfidence },
    note: {
      configTest: {
        success: testResult.success,
        statusCode: testResult.statusCode,
        itemCount: testResult.itemCount,
        responseTime: testResult.responseTime,
        error: testResult.error,
      },
    },
    status: 1,
  });

  return {
    finalResult: {
      ...finalResult,
      status: configValid ? 'complete' : 'failed',
      confidence: finalConfidence,
      reason: !configValid ? `Config test failed: ${testResult.error}` : finalResult.reason,
      config: configValid ? finalResult.config : undefined,
    },
  };
}
```

---

## Dependencies

- `@langchain/langgraph` — StateGraph implementation
- `@langchain/core` — Chat prompt templates
- `nvidia` — NVIDIA NIM client for Llama 3.3 70B

---

## Reference

- `@context/features/explorer-agent-08-exploration-loop-spec.md` — LangGraph loop
- `@context/features/explorer-agent-09-fetchconfig-generator-spec.md` — Config generation
- `@context/features/explorer-agent-07-provider-integration-spec.md` — Provider integration

---

## Notes

- **Async only in execute_tool:** Only `execute_tool` handles async tools, other nodes are sync
- **State log:** Generic table with `nextNode` and `status` supports any agent
- **Hanging pattern:** `status=0` means waiting, `status=1` means done
- **Resume:** Results API detects hanging tasks and triggers resumption
- **Config testing:** Validates FetchConfig before returning success