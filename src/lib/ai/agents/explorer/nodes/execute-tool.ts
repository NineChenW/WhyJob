// src/lib/ai/agents/explorer/nodes/execute-tool.ts

/**
 * Execute Tool Node
 *
 * Builds the pending tool call and adds it to state.
 * A separate wait-for-extension node handles the interrupt/wait logic.
 *
 * Flow:
 * 1. execute_tool: builds pending toolCall, returns state update
 * 2. wait_for_extension: calls interrupt() to suspend graph
 * 3. Extension polls /commands, executes, POSTs /results
 * 4. Results API calls graph.invoke(Command({ resume }))
 * 5. wait_for_extension: completes pending call on resume
 * 6. Graph continues to observe_result
 */

import { ExplorationStateWrapper } from '../domain';
import { createNode } from '../node-wrapper';
import {
  EXPLORATION_ACTION,
  TERMINAL_ACTIONS,
} from '../constants';
import type { ChromeExtensionTool } from '../tools/chrome-extension';
import type { ExplorationAction, ToolCall } from '../types';

interface NodeConfig {
  configurable?: {
    tool?: ChromeExtensionTool;
  };
}

/**
 * Execute Tool Node
 *
 * Builds the pending tool call based on the last LLM decision.
 * Sets waiting flag for async tools, executes sync tools directly.
 */
export const executeToolNode = createNode(
  async (wrapper: ExplorationStateWrapper, config?: NodeConfig) => {
    const lastDecision = wrapper.lastDecision;

    if (!lastDecision) {
      throw new Error('No current decision - cannot execute tool');
    }

    // Skip tool execution for terminal actions
    if (TERMINAL_ACTIONS.includes(lastDecision.action as typeof TERMINAL_ACTIONS[number])) {
      return wrapper;
    }

    // Build tool input from decision
    const toolInput = buildToolInput(lastDecision.action, lastDecision.target);

    // Determine if tool is async (extension-based) or sync (direct execution)
    const isAsyncTool = lastDecision.action !== EXPLORATION_ACTION.TEST_API;

    if (isAsyncTool) {
      return handleAsyncTool(wrapper, lastDecision.action, toolInput);
    } else {
      const tool = config?.configurable?.tool;
      if (!tool) {
        wrapper.addError({
          iteration: wrapper.iteration.iteration,
          tool: lastDecision.action,
          error: 'Chrome Extension tool not configured',
          timestamp: new Date(),
        });
        return wrapper;
      }
      return await handleSyncTool(wrapper, tool, lastDecision.action, toolInput);
    }
  }
);

/**
 * Handle async tool: build pending tool call, set waiting flag.
 * The wait-for-extension node will call interrupt() to suspend.
 */
function handleAsyncTool(
  wrapper: ExplorationStateWrapper,
  action: string,
  toolInput: Record<string, unknown>
): ExplorationStateWrapper {
  const requestId = `${wrapper.task.taskId}-${wrapper.iteration.iteration}-${Date.now()}`;

  const toolCall: ToolCall = {
    type: action as typeof EXPLORATION_ACTION[keyof typeof EXPLORATION_ACTION],
    input: toolInput,
    output: undefined,
    error: undefined,
    timestamp: new Date(),
    duration: 0,
    requestId,
    status: 'pending',
  };

  // Record tool call result (sets toolCall on last snapshot)
  wrapper.recordToolResult(toolCall, '', []);

  // Set waiting flag for extension result
  wrapper.setWaitingForExtension(true);

  return wrapper;
}

/**
 * Handle sync tool: execute directly (TEST_API), return result immediately.
 */
async function handleSyncTool(
  wrapper: ExplorationStateWrapper,
  tool: ChromeExtensionTool,
  action: string,
  toolInput: Record<string, unknown>
): Promise<ExplorationStateWrapper> {
  const startTime = Date.now();

  let output: unknown;
  let error: string | undefined;

  try {
    output = await tool.invoke({
      action: action as ExplorationAction,
      params: toolInput,
    });
  } catch (e) {
    error = String(e);
  }

  const toolCall: ToolCall = {
    type: action as typeof EXPLORATION_ACTION[keyof typeof EXPLORATION_ACTION],
    input: toolInput,
    output,
    error,
    timestamp: new Date(),
    duration: Date.now() - startTime,
    status: error ? 'failed' : 'completed',
  };

  // Record tool call result
  wrapper.recordToolResult(toolCall, '', []);

  // Record error if any
  if (error) {
    wrapper.addError({
      iteration: wrapper.iteration.iteration,
      tool: action as typeof EXPLORATION_ACTION[keyof typeof EXPLORATION_ACTION],
      error,
      timestamp: new Date(),
    });
  }

  return wrapper;
}

/**
 * Build tool input from LLM decision
 */
function buildToolInput(
  action: string,
  target?: { url?: string; selectors?: Record<string, string>; script?: string; args?: Record<string, unknown>; monitoringId?: string; filter?: unknown }
): Record<string, unknown> {
  switch (action) {
    case EXPLORATION_ACTION.NAVIGATE:
      return { url: target?.url };
    case EXPLORATION_ACTION.GET_SNAPSHOT:
      return {};
    case EXPLORATION_ACTION.EXTRACT_DOM:
      return { selectors: target?.selectors };
    case EXPLORATION_ACTION.EXECUTE_JS:
      return { script: target?.script, args: target?.args ?? {} };
    case EXPLORATION_ACTION.START_NETWORK_MONITORING:
      return {};
    case EXPLORATION_ACTION.GET_NETWORK_LOG:
      return { monitoringId: target?.monitoringId, filter: target?.filter };
    case EXPLORATION_ACTION.STOP_NETWORK_MONITORING:
      return { monitoringId: target?.monitoringId };
    case EXPLORATION_ACTION.TEST_API:
      return { url: target?.url };
    default:
      return {};
  }
}