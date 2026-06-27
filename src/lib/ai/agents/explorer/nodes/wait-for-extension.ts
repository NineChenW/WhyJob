// src/lib/ai/agents/explorer/nodes/wait-for-extension.ts

/**
 * Wait For Extension Node
 *
 * Calls interrupt() to suspend the graph on first entry.
 * On resume entry, interrupt() returns the resume value and we complete the pending call.
 *
 * Flow:
 * 1. execute_tool: builds pending toolCall, routes to wait_for_extension
 * 2. First entry: calls interrupt() → graph suspends, state checkpointed
 * 3. Extension polls /commands, executes, POSTs /results
 * 4. Results API calls graph.invoke(Command({ resume }))
 * 5. Resume entry: interrupt() returns resume value, completes pending call
 * 6. Graph continues to observe_result
 */

import { interrupt } from '@langchain/langgraph';
import { ExplorationStateWrapper } from '../domain';
import { createNode } from '../node-wrapper';

type ResumeData = { success: boolean; data?: unknown; error?: string } | null;

/**
 * Wait For Extension Node
 *
 * Suspends graph waiting for Chrome Extension to complete the pending tool call.
 * On resume, completes the pending call with the extension result.
 */
export const waitForExtensionNode = createNode(async (wrapper: ExplorationStateWrapper) => {
  // Check if we have a pending tool call from execute_tool
  if (!wrapper.hasPendingToolCall()) {
    // No pending call - something went wrong, just continue
    console.warn('[wait-for-extension] No pending tool call found');
    return wrapper;
  }

  // Call interrupt() to suspend.
  // - First entry: interrupt suspends, function doesn't continue past this line
  // - Resume entry: interrupt returns the resume value, we process it
  const resumeData = interrupt<ResumeData>(null);

  if (resumeData) {
    // Resume entry: complete the pending call with resume data
    wrapper.completePendingToolCall(resumeData.data, resumeData.error);
    wrapper.setWaitingForExtension(false);
  }

  return wrapper;
});