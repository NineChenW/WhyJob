// src/lib/ai/agents/test-agent/graph.test.ts

/**
 * Test Agent - Unit Tests
 *
 * Note: Full graph execution tests are skipped because they require
 * the NVIDIA AI provider to be configured. These tests focus on
 * state initialization and graph structure validation.
 */

import { describe, it, expect } from 'vitest';
import { initializeTestAgentState, createTestAgentGraph, getTestAgentAnnotation, TestAgent } from './graph';

describe('Test Agent - Graph', () => {
  describe('initializeTestAgentState', () => {
    it('should initialize state with taskId', () => {
      const state = initializeTestAgentState({ taskId: 'test-1' });

      expect(state.taskId).toBe('test-1');
      expect(state.messages).toEqual([]);
      expect(state.llmCallCount).toBe(0);
      expect(state.lastResponse).toBeUndefined();
      expect(state.error).toBeUndefined();
    });

    it('should initialize state with messages', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'system' as const, content: 'You are helpful' },
      ];
      const state = initializeTestAgentState({ taskId: 'test-2', messages });

      expect(state.taskId).toBe('test-2');
      expect(state.messages).toEqual(messages);
    });
  });

  describe('createTestAgentGraph', () => {
    it('should create a graph with LLM node', () => {
      const graph = createTestAgentGraph();

      expect(graph).toBeDefined();
      expect(typeof graph.addNode).toBe('function');
      expect(typeof graph.addEdge).toBe('function');
      expect(typeof graph.compile).toBe('function');
    });
  });

  describe('getTestAgentAnnotation', () => {
    it('should return the state annotation', () => {
      const annotation = getTestAgentAnnotation();

      expect(annotation).toBeDefined();
      expect(typeof annotation).toBe('object');
    });
  });

  describe('TestAgent class (object-oriented)', () => {
    it('should create a TestAgent instance', () => {
      const agent = new TestAgent();

      expect(agent).toBeDefined();
      expect(typeof agent.run).toBe('function');
      expect(typeof agent.createGraph).toBe('function');
      expect(typeof agent.compile).toBe('function');
    });

    it('should create graph (verify node structure)', () => {
      const agent = new TestAgent();
      const graph = agent.createGraph();

      expect(graph).toBeDefined();
      // Verify graph has the expected builder methods (not calling compile which requires nodes)
      expect(typeof graph.addNode).toBe('function');
      expect(typeof graph.addEdge).toBe('function');
    });
  });
});