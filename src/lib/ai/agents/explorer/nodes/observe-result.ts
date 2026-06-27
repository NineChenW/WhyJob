// src/lib/ai/agents/explorer/nodes/observe-result.ts

/**
 * Observe Result Node
 *
 * Parses tool output and extracts:
 * - Discoveries (API endpoints, job data, etc.)
 * - Network calls
 * - Page visits
 * - Updated context (currentUrl, monitoringId)
 */

import { parseToolResult } from '../result-parser';
import { ExplorationStateWrapper } from '../domain';
import { createNode } from '../node-wrapper';

/**
 * Observe Result Node
 *
 * Parses the last tool call output and extracts discoveries, network calls,
 * page visits, and updates the wrapper state accordingly.
 */
export const observeResultNode = createNode(async (wrapper: ExplorationStateWrapper) => {
  const lastDecision = wrapper.lastDecision;
  const lastSnapshot = wrapper.history.lastSnapshot;

  if (!lastDecision || !lastSnapshot?.toolCall) {
    return wrapper;
  }

  const toolCall = lastSnapshot.toolCall;
  const parsed = parseToolResult(
    lastDecision.action,
    toolCall.output,
    toolCall.error
  );

  // Set observation on the last snapshot
  wrapper.setObservation(parsed.observation);

  // Add discoveries if any found
  if (parsed.discoveries.length > 0) {
    wrapper.addDiscoveries(parsed.discoveries);
  }

  // Record page visit if navigating
  if (parsed.pageVisit) {
    wrapper.navigateTo(parsed.pageVisit.url, parsed.pageVisit.title);
  }

  // Update monitoring ID if returned
  if (parsed.monitoringId) {
    wrapper.setMonitoringId(parsed.monitoringId);
  }

  return wrapper;
});