// src/lib/ai/agents/explorer/nodes/wait-for-extension.test.ts

/**
 * Unit tests for wait-for-extension node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExplorationStateWrapper } from '../domain';

// Mock @langchain/langgraph before importing the node
vi.mock('@langchain/langgraph', () => ({
  interrupt: vi.fn(),
}));

import { waitForExtensionNode } from './wait-for-extension';
import { interrupt } from '@langchain/langgraph';
import { initializeExplorationState } from '../graph';

describe('waitForExtensionNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockWrapper = (hasPendingCall = false): ExplorationStateWrapper => {
    const state = initializeExplorationState({
      taskId: 'test-task-001',
      companyId: 'company-001',
      company: { id: 'company-001', name: 'Test Corp', website: 'https://test.com' },
      contentTypes: ['job_listing'],
      maxIterations: 5,
    });

    const wrapper = new ExplorationStateWrapper(state);

    if (hasPendingCall) {
      // Add a pending tool call to the last snapshot
      wrapper.recordDecision({
        action: 'NAVIGATE',
        target: { url: 'https://example.com' },
        reasoning: 'Navigate to example',
        confidence: 80,
      });
      // Mark it as pending by directly modifying (test setup)
      const lastSnapshot = wrapper.history.lastSnapshot;
      if (lastSnapshot) {
        lastSnapshot.toolCall = {
          type: 'NAVIGATE',
          input: { url: 'https://example.com' },
          output: undefined,
          timestamp: new Date(),
          duration: 0,
          requestId: 'test-task-001-1-1234567890',
          status: 'pending',
        };
      }
    }

    return wrapper;
  };

  describe('when no pending tool call exists', () => {
    it('should return empty update and warn', async () => {
      const wrapper = createMockWrapper(false);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await waitForExtensionNode(wrapper.raw);

      expect(result).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith('[wait-for-extension] No pending tool call found');
      consoleSpy.mockRestore();
    });
  });

  describe('when pending tool call exists', () => {
    it('should call interrupt() to wait for extension result on first entry', async () => {
      const wrapper = createMockWrapper(true);

      // interrupt returns undefined when first called (suspends, doesn't return)
      vi.mocked(interrupt).mockReturnValue(undefined);

      const resultPromise = waitForExtensionNode(wrapper.raw);

      // interrupt should have been called
      expect(interrupt).toHaveBeenCalledWith(null);

      // Since interrupt returns undefined (first invocation), the node returns empty
      const result = await resultPromise;
      expect(result).toEqual({});
    });
  });
});