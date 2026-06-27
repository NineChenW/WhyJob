# Explorer Agent - Chrome Extension Command API (Iteration 12)

## Overview

Fix the broken `ChromeExtensionTool.postCommand()` which POSTs to `/api/agent/commands` (non-existent endpoint) and replace with a clean graph interface approach.

**Root Cause:**
- `ChromeExtensionTool.postCommand()` calls `fetch('/api/agent/commands', { method: 'POST' })` to queue a command
- But `/api/agent/commands` only has a GET handler - no POST handler exists
- The POST fails silently (or throws), but the command info IS saved to `FetchTask.currentAction/currentTarget` by `execute_tool`

**New Approach:**
1. When `execute_tool` handles an async tool, it logs state to `AgentStateLog` (status=0) and updates `FetchTask.currentAction/currentTarget` - this already works
2. A graph interface function `getCommandByTaskId(taskId)` returns the queued command info for the extension
3. A function `postToolResult(taskId, stateLogId, result)` updates the state log and triggers node routing
4. Remove the broken POST to `/api/agent/commands` from `ChromeExtensionTool.postCommand()`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LangGraph Explorer Agent                                │
│                                                                              │
│   execute_tool (async) → logs to AgentStateLog (status=0)                   │
│                        → updates FetchTask.currentAction/currentTarget      │
│                        → returns early (waitingForExtensionResult=true)      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Commands GET polls this
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Graph Interface (in-memory or API)                      │
│                                                                              │
│   getCommandByTaskId(taskId) → { taskId, stateLogId, command }               │
│   postToolResult(taskId, stateLogId, result) → triggers observe_result      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Extension polls /api/agent/commands
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Chrome Extension                                     │
│                                                                              │
│   GET /api/agent/commands?taskId=xxx → receives command                     │
│   POST /api/agent/results → posts result                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Changes

### 1. `src/lib/ai/agents/explorer/tools/chrome-extension.ts`

**Change:** Remove the `POST /api/agent/commands` call from `postCommand()`. The command is already queued via `FetchTask.currentAction/currentTarget` by `execute_tool`.

```typescript
/**
 * Post command to extension queue (async - returns requestId immediately)
 * Use this for browser tools like NAVIGATE, GET_SNAPSHOT, etc.
 * The caller (execute_tool) handles state persistence.
 *
 * Note: No longer sends POST to /api/agent/commands - that endpoint doesn't exist.
 * The command info is stored in FetchTask by execute_tool node.
 */
async postCommand(input: ToolInput): Promise<string> {
  const { action, params = {} } = input;
  const requestId = this.buildRequestId();
  // Command is queued via FetchTask.currentAction/currentTarget (set by execute_tool)
  // No HTTP POST needed here - trust the generator
  console.log(`[ChromeExtensionTool] postCommand: ${action}, requestId: ${requestId}`);
  return requestId;
}
```

### 2. `src/lib/ai/agents/explorer/graph.ts`

**Add:** Graph interface functions for Commands API.

```typescript
/**
 * Get command for a task by taskId
 *
 * Called by GET /api/agent/commands to retrieve the queued command
 * from the LangGraph agent's state.
 *
 * @returns Command info including taskId, stateLogId, action, params, requestId
 */
export async function getCommandByTaskId(taskId: string): Promise<{
  taskId: string;
  stateLogId: string;
  action: ExplorationAction;
  params: Record<string, unknown>;
  requestId: string;
} | null> {
  const log = await getLatestStateLog(taskId);
  if (!log) return null;

  const note = log.note as StateLogNote | null;
  if (!note?.asyncTool?.commandQueued) return null;

  const toolCall = note.toolCall as { tool: string; input: unknown } | undefined;

  return {
    taskId,
    stateLogId: log.id,
    action: note.asyncTool.toolName as ExplorationAction,
    params: (toolCall?.input as Record<string, unknown>) ?? {},
    requestId: note.asyncTool.requestId,
  };
}

/**
 * Post tool execution result and trigger node routing
 *
 * Called by POST /api/agent/results to update the state log
 * with the tool result and route to the appropriate node.
 *
 * @param taskId - The task ID
 * @param stateLogId - The state log ID to update
 * @param result - The tool execution result { success, data, error }
 * @returns Updated state log entry
 */
export async function postToolResult(
  taskId: string,
  stateLogId: string,
  result: { success: boolean; data?: unknown; error?: string }
): Promise<{ status: 1; nextNode: string }> {
  const log = await prisma.agentStateLog.findUnique({ where: { id: stateLogId } });
  if (!log) throw new Error(`State log not found: ${stateLogId}`);

  const existingNote = (log.note as StateLogNote) || {};
  const existingToolCall = existingNote.toolCall as { tool: string; input: unknown } | undefined;
  const existingAsyncTool = existingNote.asyncTool as { toolName: string; requestId: string } | undefined;

  const updatedNote: StateLogNote = {
    ...existingNote,
    toolCall: {
      tool: existingToolCall?.tool ?? 'chrome_extension',
      input: existingToolCall?.input ?? {},
      output: result.data,
      error: result.error,
    },
    asyncTool: {
      toolName: existingAsyncTool?.toolName ?? 'chrome_extension',
      requestId: existingAsyncTool?.requestId ?? '',
      commandQueued: true,
      waitingForResult: false, // Result received
    },
  };

  await updateStateLog(stateLogId, {
    status: 1,
    nextNode: 'observe_result',
    note: updatedNote,
  });

  return { status: 1, nextNode: 'observe_result' };
}

/**
 * Resume the explorer graph after async tool result
 *
 * Called by the server action / cron after result is posted.
 * Loads the saved state and continues the ReAct loop.
 */
export async function resumeExplorerGraph(taskId: string, serverUrl: string): Promise<ExplorationState> {
  const { getResumeContext } = require('@/lib/ai/state-log');

  const resumeContext = await getResumeContext(taskId);
  if (!resumeContext) {
    throw new Error(`No resume context found for task: ${taskId}`);
  }

  const state = resumeContext.state as ExplorationState;
  const { ChromeExtensionTool } = require('./tools/chrome-extension');

  const graph = createExplorerGraph();
  const compiled = graph.compile();
  const tool = new ChromeExtensionTool(serverUrl, state.taskId);

  const result = await compiled.invoke(state as any, {
    configurable: { tool },
  });

  return result as ExplorationState;
}
```

### 3. `src/app/api/agent/commands/route.ts`

**Change:** Use `getCommandByTaskId()` from graph interface instead of manually querying FetchTask.

```typescript
// After loading task...
const commandInfo = await getCommandByTaskId(taskId);

if (commandInfo) {
  const requestId = commandInfo.requestId;
  const command = decisionToCommand(
    {
      action: commandInfo.action,
      targetUrl: commandInfo.params.url as string | undefined,
    },
    requestId
  );

  return NextResponse.json({
    commands: [command],
    serverUrl: '',
    taskStatus: 'exploring',
    iteration: task.iterations,
    stateLogId: commandInfo.stateLogId,
  });
}
```

### 4. `src/app/api/agent/results/route.ts`

**Change:** Use `postToolResult()` from graph interface to update state log.

```typescript
// Instead of manually updating state log...
const graphInterface = require('@/lib/ai/agents/explorer/graph');

// Find the state log for this task
const stateLogId = result.stateLogId; // passed from extension
if (stateLogId) {
  await graphInterface.postToolResult(taskId, stateLogId, {
    success: result.success,
    data: result.data,
    error: result.error,
  });
}

// Trigger resume
await resumeExplorerGraph(taskId, serverUrl);
```

---

## Data Flow

### Async Tool Invocation Flow

```
1. llm_decision → decides NAVIGATE to https://example.com
2. check_termination → passes (not terminal)
3. execute_tool → handleAsyncTool()
   a. Builds toolInput { url: "https://example.com" }
   b. Calls tool.postCommand({ action: 'NAVIGATE', params: { url: "https://example.com" } })
      - postCommand() just returns requestId (no HTTP call now)
   c. Logs to AgentStateLog (status=0)
   d. Updates FetchTask.currentAction = 'NAVIGATE', currentTarget = 'https://example.com'
   e. Returns { waitingForExtensionResult: true }
4. Graph returns to caller (pickup/process endpoint)
5. Extension polls GET /api/agent/commands?taskId=xxx
6. Commands API calls getCommandByTaskId() → returns { action, params, requestId, stateLogId }
7. Extension executes NAVIGATE in browser
8. Extension POSTs result to /api/agent/results
9. Results API calls postToolResult(stateLogId, result)
10. Results API calls resumeExplorerGraph(taskId)
11. Graph resumes at observe_result → reflect → llm_decision
```

---

## File Changes

```
Modified:
- src/lib/ai/agents/explorer/tools/chrome-extension.ts    # Remove POST from postCommand()
- src/lib/ai/agents/explorer/graph.ts                       # Add getCommandByTaskId, postToolResult, resumeExplorerGraph
- src/app/api/agent/commands/route.ts                      # Use getCommandByTaskId()
- src/app/api/agent/results/route.ts                       # Use postToolResult(), resumeExplorerGraph()
```

---

## References

- Iteration 11: `context/features/explorer-agent-11-langgraph-wiring-spec.md`
- `ChromeExtensionTool.postCommand()`: `src/lib/ai/agents/explorer/tools/chrome-extension.ts`
- `execute_tool handleAsyncTool()`: `src/lib/ai/agents/explorer/nodes/execute-tool.ts`
- `getCommandByTaskId()`: `src/lib/ai/agents/explorer/graph.ts` (new)
- `postToolResult()`: `src/lib/ai/agents/explorer/graph.ts` (new)

---

## Notes

- The broken POST to `/api/agent/commands` is removed - no such endpoint exists
- Command info flows through: execute_tool → AgentStateLog + FetchTask → Commands GET → Extension
- Result info flows through: Extension → Results POST → AgentStateLog → resumeExplorerGraph
- LangGraph state (via AgentStateLog) IS the checkpoint - no separate state serialization needed