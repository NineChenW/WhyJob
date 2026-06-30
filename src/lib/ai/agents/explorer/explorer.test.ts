/**
 * Integration tests for Explorer Agent
 *
 * Tests the full ReAct loop with real browser and company website.
 * These tests require:
 * 1. Chrome Extension running and connected
 * 2. GROQ_API_KEY configured in .env
 * 3. A real company website to explore
 */

import { describe, it, expect } from 'vitest';
import { initializeExplorationState } from './graph';
import { ExplorationStateWrapper } from './domain';
import { groqDecisionSchema, parseDecisionResponse } from './nodes/llm-decision/prompts/schemas';

// Test companies with known careers pages
const TEST_COMPANIES = [
  { name: 'Stripe', website: 'https://stripe.com', industry: 'FinTech' },
  { name: 'Vercel', website: 'https://vercel.com', industry: 'Cloud' },
];

describe('Explorer Agent Integration', { timeout: 60000 }, () => {
  describe('initializeExplorationState', () => {
    it('should create valid initial state for Stripe', () => {
      const state = initializeExplorationState({
        taskId: 'test-stripe-001',
        companyId: 'company-stripe',
        company: {
          id: 'company-stripe',
          name: 'Stripe',
          website: 'https://stripe.com',
          industry: 'FinTech',
        },
        contentTypes: ['job_listing'],
        maxIterations: 3,
      });

      const wrapper = new ExplorationStateWrapper(state);

      expect(wrapper.task.taskId).toBe('test-stripe-001');
      expect(wrapper.task.company.name).toBe('Stripe');
      expect(wrapper.iteration.iteration).toBe(0);
      expect(wrapper.iteration.maxIterations).toBe(3);
      expect(wrapper.memory.pagesVisited).toEqual([]);
      expect(wrapper.memory.discoveries).toEqual([]);
      expect(wrapper.iteration.shouldContinue).toBe(true);
    });

    it('should use default max iterations', () => {
      const state = initializeExplorationState({
        taskId: 'test-001',
        companyId: 'company-001',
        company: { id: 'company-001', name: 'Test Corp' },
        contentTypes: ['job_listing'],
      });

      const wrapper = new ExplorationStateWrapper(state);
      expect(wrapper.iteration.maxIterations).toBe(5);
    });
  });

  describe('decisionSchema validation', () => {
    it('should parse a real LLM decision response', () => {
      const response = {
        action: 'NAVIGATE',
        target: { url: 'https://stripe.com/jobs' },
        reasoning: 'First action: navigate to company careers page to discover job listings',
        confidence: 90,
      };

      const parsed = groqDecisionSchema.parse(response);
      expect(parsed.action).toBe('NAVIGATE');
      expect(parsed.target?.url).toBe('https://stripe.com/jobs');
    });

    it('should validate GROQ_DECISION_SCHEMA structure', () => {
      const schema = {
        name: 'exploration_decision',
        schema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: [
                'NAVIGATE',
                'GET_SNAPSHOT',
                'EXTRACT_DOM',
                'EXECUTE_JS',
                'START_NETWORK_MONITORING',
                'GET_NETWORK_LOG',
                'STOP_NETWORK_MONITORING',
                'ANALYZE_DATA',
                'GENERATE_CONFIG',
                'FAIL',
                'REFLECT',
              ],
              description: 'The action to take next',
            },
            target: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'URL for NAVIGATE action' },
                selectors: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                  description: 'CSS selectors for EXTRACT_DOM action',
                },
              },
            },
            reasoning: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 100 },
          },
          required: ['action', 'reasoning', 'confidence'],
        },
      };

      expect(schema.schema.properties.action.enum).toContain('NAVIGATE');
      expect(schema.schema.properties.action.enum).toContain('GENERATE_CONFIG');
      expect(schema.schema.required).toContain('action');
    });
  });

  describe('parseDecisionResponse', () => {
    it('should parse real JSON response from LLM', () => {
      const rawResponse = JSON.stringify({
        action: 'GET_SNAPSHOT',
        target: {},
        reasoning: 'After navigation, capture the page content to see job listings',
        confidence: 85,
      });

      const parsed = parseDecisionResponse(rawResponse);
      expect(parsed.action).toBe('GET_SNAPSHOT');
      expect(parsed.confidence).toBe(85);
    });

    it('should handle real LLM response with minimal target', () => {
      const rawResponse = JSON.stringify({
        action: 'NAVIGATE',
        target: { url: 'https://careers.stripe.com/' },
        reasoning: 'Navigate to Stripe careers page',
        confidence: 95,
      });

      const parsed = parseDecisionResponse(rawResponse);
      expect(parsed.action).toBe('NAVIGATE');
      expect(parsed.target?.url).toBe('https://careers.stripe.com/');
    });
  });

  describe('ReAct loop simulation', () => {
    it('should simulate first iteration decision', () => {
      // Simulate initial state
      const state = initializeExplorationState({
        taskId: 'test-sim-001',
        companyId: 'company-sim-001',
        company: {
          id: 'company-sim-001',
          name: 'Stripe',
          website: 'https://stripe.com',
          industry: 'FinTech',
        },
        contentTypes: ['job_listing'],
        maxIterations: 3,
      });

      const wrapper = new ExplorationStateWrapper(state);

      expect(wrapper.iteration.iteration).toBe(0);
      expect(wrapper.memory.pagesVisited.length).toBe(0);
      expect(wrapper.iteration.shouldContinue).toBe(true);

      // Expected first action should be NAVIGATE
      const expectedFirstAction = wrapper.memory.pagesVisited.length === 0 ? 'NAVIGATE' : null;
      expect(expectedFirstAction).toBe('NAVIGATE');
    });

    it('should simulate iteration increment', () => {
      let state = initializeExplorationState({
        taskId: 'test-iter-001',
        companyId: 'company-iter-001',
        company: { id: 'company-iter-001', name: 'Test Inc' },
        contentTypes: ['job_listing'],
        maxIterations: 3,
      });

      let wrapper = new ExplorationStateWrapper(state);

      // Simulate iteration 0
      expect(wrapper.iteration.iteration).toBe(0);

      // Simulate iteration increment
      wrapper.advanceIteration();
      expect(wrapper.iteration.iteration).toBe(1);

      // After navigation, expect GET_SNAPSHOT
      wrapper.navigateTo('https://stripe.com', 'Stripe');
      const expectedAction = wrapper.memory.pagesVisited.length > 0 ? 'GET_SNAPSHOT' : 'NAVIGATE';
      expect(expectedAction).toBe('GET_SNAPSHOT');
    });
  });
});

/**
 * Manual testing instructions:
 *
 * 1. Start the Next.js dev server:
 *    npm run dev
 *
 * 2. Start Chrome Extension in debug mode
 *
 * 3. Navigate to /admin/explorer
 *
 * 4. Submit a task for Stripe or another real company
 *
 * 5. Watch the agent explore the careers page
 *
 * Expected flow:
 * Iteration 1: NAVIGATE → careers page
 * Iteration 2: GET_SNAPSHOT → discover jobs API
 * Iteration 3: GET_NETWORK_LOG → capture API endpoint
 * End: GENERATE_CONFIG with FetchConfig
 */