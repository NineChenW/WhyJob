// src/lib/ai/agents/explorer/nodes/observe-result.ts

import { parseToolResult } from '../result-parser';
import type { ExplorationState } from '../types';

/**
 * Observe Result Node
 *
 * Parses tool output and extracts:
 * - Discoveries (API endpoints, job data, etc.)
 * - Network calls
 * - Page visits
 * - Updated state (currentUrl, monitoringId)
 */
export async function observeResultNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const { currentDecision, toolCalls } = state;

  if (!currentDecision || toolCalls.length === 0) {
    return {};
  }

  const lastCall = toolCalls[toolCalls.length - 1];
  const parsed = parseToolResult(currentDecision.action, lastCall.output, lastCall.error);

  // Update ReAct trace with observation
  const updatedTrace = state.reactTrace.map((step, i) =>
    i === state.reactTrace.length - 1
      ? { ...step, observation: parsed.observation }
      : step
  );

  return {
    reactTrace: updatedTrace,
    pagesVisited: parsed.pageVisit ? [parsed.pageVisit] : [],
    discoveries: parsed.discoveries,
    networkCalls: parsed.networkCalls,
    currentUrl: parsed.currentUrl ?? state.currentUrl,
    pendingMonitoringId: parsed.monitoringId ?? state.pendingMonitoringId,
  };
}