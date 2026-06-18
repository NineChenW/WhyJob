// src/lib/ai/agents/explorer/nodes/execute-tool.ts

import type { ExplorationState, LLMSDecision, ToolCall } from '../types';
import type { ChromeExtensionTool } from '../tools/chrome-extension';
import { TERMINAL_ACTIONS } from '../constants';
import { createStateLog } from '@/lib/ai/state-log';

const AGENT_NAME = 'explorer';

interface NodeConfig {
  configurable?: {
    tool?: ChromeExtensionTool;
  };
}

/**
 * Execute Tool Node
 *
 * Handles both sync and async tools:
 * - Sync (TEST_API): executes directly, returns immediately
 * - Async (NAVIGATE, GET_SNAPSHOT, etc.): posts command to extension,
 *   logs with status=0 (hang), returns pending status
 *
 * Resume flow: On re-invocation with same taskId, if a pending tool call
 * exists with results already posted (via Results API), complete it and
 * continue without re-queuing.
 */
export async function executeToolNode(
  state: ExplorationState,
  config?: NodeConfig
): Promise<Partial<ExplorationState>> {
  const { currentDecision, iteration, taskId } = state;

  if (!currentDecision) {
    throw new Error('No current decision - cannot execute tool');
  }

  // Skip tool execution for terminal actions
  if (TERMINAL_ACTIONS.includes(currentDecision.action as typeof TERMINAL_ACTIONS[number])) {
    return {};
  }

  // Get tool from config
  const tool = config?.configurable?.tool;
  if (!tool) {
    return {
      errors: [
        ...state.errors,
        {
          iteration,
          tool: currentDecision.action,
          error: 'Chrome Extension tool not configured',
          timestamp: new Date(),
        },
      ],
    };
  }

  // Check for pending tool call from previous invocation (resume scenario)
  const lastCall = state.toolCalls[state.toolCalls.length - 1];
  if (lastCall?.status === 'pending') {
    return handlePendingToolCall(state, tool, lastCall);
  }

  // Build tool input
  const toolInput = buildToolInput(currentDecision);

  // Determine if tool is async (extension-based) or sync (direct execution)
  const isAsyncTool = !['TEST_API'].includes(currentDecision.action);

  if (isAsyncTool) {
    return handleAsyncTool(state, tool, toolInput);
  } else {
    return handleSyncTool(state, tool, toolInput);
  }
}

/**
 * Handle async tool: post command to extension, log with status=0, return early.
 * On re-invocation (resume), complete the pending call if results are available.
 */
async function handleAsyncTool(
  state: ExplorationState,
  tool: ChromeExtensionTool,
  toolInput: Record<string, unknown>
): Promise<Partial<ExplorationState>> {
  const { currentDecision, iteration, taskId } = state;
  if (!currentDecision) throw new Error('No current decision');

  const startTime = Date.now();
  const requestId = `${taskId}-${iteration}-${Date.now()}`;

  // Post command to extension queue (non-blocking)
  await tool.postCommand({
    action: currentDecision.action,
    params: toolInput,
  });

  const toolCall: ToolCall = {
    tool: currentDecision.action,
    input: toolInput,
    output: undefined,
    error: undefined,
    timestamp: new Date(),
    duration: Date.now() - startTime,
    requestId,
    status: 'pending',
  };

  // Log state with status=0 (Hang up) for async resume tracking
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
        tool: currentDecision.action,
        input: toolInput,
      },
      asyncTool: {
        toolName: currentDecision.action,
        requestId,
        commandQueued: true,
        waitingForResult: true,
      },
      duration: Date.now() - startTime,
    },
    nextNode: 'execute_tool', // Resume this node on re-invocation
    status: 0, // Hang up - waiting for extension result
  });

  return {
    toolCalls: [...state.toolCalls, toolCall],
    waitingForExtensionResult: true,
  };
}

/**
 * Handle sync tool: execute directly (TEST_API), return result immediately.
 * Logs with status=1 (Done).
 */
async function handleSyncTool(
  state: ExplorationState,
  tool: ChromeExtensionTool,
  toolInput: Record<string, unknown>
): Promise<Partial<ExplorationState>> {
  const { currentDecision, iteration, taskId } = state;
  if (!currentDecision) throw new Error('No current decision');

  const startTime = Date.now();

  let output: unknown;
  let error: string | undefined;

  try {
    output = await tool.invoke({
      action: currentDecision.action,
      params: toolInput,
    });
  } catch (e) {
    error = String(e);
  }

  const toolCall: ToolCall = {
    tool: currentDecision.action,
    input: toolInput,
    output,
    error,
    timestamp: new Date(),
    duration: Date.now() - startTime,
    status: 'completed',
  };

  // Log state with status=1 (Done)
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
        tool: currentDecision.action,
        input: toolInput,
        output,
        error,
      },
      duration: Date.now() - startTime,
    },
    nextNode: 'observe_result',
    status: 1, // Done
  });

  return {
    toolCalls: [...state.toolCalls, toolCall],
    errors: error
      ? [...state.errors, { iteration, tool: currentDecision.action, error, timestamp: new Date() }]
      : state.errors,
  };
}

/**
 * Handle resume scenario: pending tool call exists from previous invocation.
 * Check if Results API has posted results; if so, complete it.
 */
async function handlePendingToolCall(
  state: ExplorationState,
  tool: ChromeExtensionTool,
  pendingCall: ToolCall
): Promise<Partial<ExplorationState>> {
  const { currentDecision, iteration, taskId } = state;
  if (!currentDecision || !pendingCall.requestId) return {};

  const startTime = Date.now();

  let output: unknown;
  let error: string | undefined;

  // Try to get result from Results API
  try {
    output = await tool.waitForResult(pendingCall.requestId, 5000);
  } catch {
    // Result not yet available - return pending status and continue (graph will re-invoke)
    return {
      toolCalls: [...state.toolCalls, pendingCall],
    };
  }

  // Result is available - complete the pending call
  const completedCall: ToolCall = {
    ...pendingCall,
    output,
    error,
    timestamp: new Date(),
    duration: Date.now() - startTime,
    status: 'completed',
  };

  // Log state with status=1 (Done) - resuming
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
        tool: currentDecision.action,
        input: pendingCall.input,
        output,
        error,
      },
      asyncTool: {
        toolName: currentDecision.action,
        requestId: pendingCall.requestId,
        commandQueued: true,
        waitingForResult: false, // Result received
      },
      duration: Date.now() - startTime,
    },
    nextNode: 'observe_result',
    status: 1, // Done - resuming
  });

  return {
    toolCalls: [...state.toolCalls, completedCall],
    waitingForExtensionResult: false, // Clear - result received
    errors: error
      ? [...state.errors, { iteration, tool: currentDecision.action, error, timestamp: new Date() }]
      : state.errors,
  };
}

/**
 * Build tool input from LLM decision
 */
function buildToolInput(decision: LLMSDecision): Record<string, unknown> {
  const { action, target } = decision;

  switch (action) {
    case 'NAVIGATE':
      return { url: target?.url };
    case 'GET_SNAPSHOT':
      return {};
    case 'EXTRACT_DOM':
      return { selectors: target?.selectors };
    case 'EXECUTE_JS':
      return { script: target?.script, args: target?.args ?? {} };
    case 'START_NETWORK_MONITORING':
      return {};
    case 'GET_NETWORK_LOG':
      return { monitoringId: target?.monitoringId, filter: target?.filter };
    case 'STOP_NETWORK_MONITORING':
      return { monitoringId: target?.monitoringId };
    case 'TEST_API':
      return { url: target?.url };
    default:
      return {};
  }
}