// src/lib/ai/agents/explorer/nodes/execute-tool.ts

import type { ExplorationState, LLMSDecision, ToolCall } from '../types';
import type { ChromeExtensionTool } from '../tools/chrome-extension';
import { TERMINAL_ACTIONS } from '../constants';

interface NodeConfig {
  configurable?: {
    tool?: ChromeExtensionTool;
  };
}

/**
 * Execute Tool Node
 *
 * Invokes the Chrome Extension tool with parameters from currentDecision.
 * Handles the command/response protocol with the extension.
 */
export async function executeToolNode(
  state: ExplorationState,
  config?: NodeConfig
): Promise<Partial<ExplorationState>> {
  const { currentDecision } = state;
  if (!currentDecision) {
    throw new Error('No current decision - cannot execute tool');
  }

  // Skip tool execution for terminal actions
  if (TERMINAL_ACTIONS.includes(currentDecision.action as typeof TERMINAL_ACTIONS[number])) {
    return {};
  }

  // Get tool from config (passed via configurable)
  const tool = config?.configurable?.tool;
  if (!tool) {
    return {
      errors: [
        ...state.errors,
        {
          iteration: state.iteration,
          tool: currentDecision.action,
          error: 'Chrome Extension tool not configured',
          timestamp: new Date(),
        },
      ],
    };
  }

  // Build tool input from decision
  const toolInput = buildToolInput(currentDecision);
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
  };

  return {
    toolCalls: [toolCall],
    errors: error
      ? [...state.errors, { iteration: state.iteration, tool: currentDecision.action, error, timestamp: new Date() }]
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
    default:
      return {};
  }
}