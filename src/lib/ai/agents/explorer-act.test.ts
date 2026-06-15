/**
 * Unit tests for Explorer Agent ACT Loop functions (explorer-act.ts)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  decideNextAction,
  analyzeActionResult,
  generateConfig,
  decisionToCommand,
  type TaskState,
  type Discovery,
} from './explorer-act';

// Mock the fetch module to avoid network calls
vi.mock('@/lib/fetch', () => ({
  testFetchConfig: vi.fn().mockResolvedValue({
    success: true,
    url: 'https://example.com',
    statusCode: 200,
    data: { jobs: [] },
  }),
}));

describe('decideNextAction', () => {
  const baseState: TaskState = {
    id: 'task-1',
    companyId: 'company-1',
    company: { name: 'Tesla', website: 'https://tesla.com' },
    contentTypes: ['job_listing'],
    iterations: 0,
    pagesVisited: [],
    discoveries: [],
    currentAction: null,
    currentTarget: null,
  };

  it('should return NAVIGATE for first iteration with no pages visited', () => {
    const decision = decideNextAction(baseState);
    expect(decision.action).toBe('NAVIGATE');
    expect(decision.targetUrl).toBe('https://tesla.com');
  });

  it('should return NAVIGATE with search URL if no website', () => {
    const state = { ...baseState, company: { name: 'Unknown Corp' } };
    const decision = decideNextAction(state);
    expect(decision.action).toBe('NAVIGATE');
    expect(decision.targetUrl).toContain('google.com/search');
  });

  it('should return TEST_API if api_endpoint discovered', () => {
    const state = {
      ...baseState,
      iterations: 1,
      pagesVisited: ['https://tesla.com'],
      discoveries: [{ type: 'api_endpoint' as const, url: 'https://api.tesla.com/jobs' }],
    };
    const decision = decideNextAction(state);
    expect(decision.action).toBe('TEST_API');
    expect(decision.targetUrl).toBe('https://api.tesla.com/jobs');
  });

  it('should return FAIL if no content after 2 iterations', () => {
    const state = { ...baseState, iterations: 2, discoveries: [] };
    const decision = decideNextAction(state);
    expect(decision.action).toBe('FAIL');
  });

  it('should return EXTRACT_DOM if webpage discovered and iterations < 3', () => {
    const state = {
      ...baseState,
      iterations: 1,
      pagesVisited: ['https://tesla.com'],
      discoveries: [{ type: 'webpage' as const, url: 'https://tesla.com/careers' }],
    };
    const decision = decideNextAction(state);
    expect(decision.action).toBe('EXTRACT_DOM');
  });

  it('should return GENERATE_CONFIG if has discoveries', () => {
    const state = {
      ...baseState,
      iterations: 3,
      pagesVisited: ['https://tesla.com', 'https://tesla.com/careers'],
      discoveries: [{ type: 'webpage' as const, url: 'https://tesla.com/careers' }],
    };
    const decision = decideNextAction(state);
    expect(decision.action).toBe('GENERATE_CONFIG');
  });

  it('should try careers page if not visited', () => {
    const state = {
      ...baseState,
      iterations: 1,
      pagesVisited: ['https://tesla.com'],
      discoveries: [],
    };
    const decision = decideNextAction(state);
    expect(decision.action).toBe('NAVIGATE');
    expect(decision.targetUrl).toContain('/careers');
  });
});

describe('analyzeActionResult', () => {
  it('should return no_content on failed action', () => {
    const result = analyzeActionResult('NAVIGATE', { success: false, error: 'Timeout' }, {});
    expect(result?.type).toBe('no_content');
    expect(result?.reason).toBe('Timeout');
  });

  it('should return webpage on successful NAVIGATE', () => {
    const result = analyzeActionResult('NAVIGATE', { success: true, url: 'https://example.com', title: 'Jobs' }, {});
    expect(result?.type).toBe('webpage');
    expect(result?.url).toBe('https://example.com');
    expect(result?.data).toEqual({ title: 'Jobs' });
  });

  it('should return no_content on NAVIGATE with no URL', () => {
    const result = analyzeActionResult('NAVIGATE', { success: true }, {});
    expect(result?.type).toBe('no_content');
  });

  it('should return webpage on successful EXTRACT_DOM', () => {
    const decision = { action: 'EXTRACT_DOM', targetUrl: 'https://example.com', selectors: { title: 'h1' } };
    const result = analyzeActionResult('EXTRACT_DOM', { success: true, data: { title: 'Job Title' } }, decision);
    expect(result?.type).toBe('webpage');
    expect(result?.url).toBe('https://example.com');
    expect(result?.selectors).toEqual({ title: 'h1' });
  });

  it('should return no_content on EXTRACT_DOM with empty data', () => {
    const decision = { action: 'EXTRACT_DOM', targetUrl: 'https://example.com' };
    const result = analyzeActionResult('EXTRACT_DOM', { success: true, data: {} }, decision);
    expect(result?.type).toBe('no_content');
  });

  it('should return no_content on TEST_API failure without auth', () => {
    const decision = { action: 'TEST_API' as const, targetUrl: 'https://api.example.com' };
    // success: false, no statusCode = generic failure
    const result = analyzeActionResult('TEST_API', { success: false }, decision);
    expect(result?.type).toBe('no_content');
  });

  it('should return api_endpoint on successful TEST_API with 200', () => {
    const decision = { action: 'TEST_API' as const, targetUrl: 'https://api.example.com/jobs' };
    const result = analyzeActionResult('TEST_API', { success: true, responseData: { jobs: [] }, statusCode: 200 }, decision);
    expect(result?.type).toBe('api_endpoint');
    expect(result?.url).toBe('https://api.example.com/jobs');
  });
});

describe('generateConfig', () => {
  const baseState: TaskState = {
    id: 'task-1',
    companyId: 'company-1',
    company: { name: 'Stripe', website: 'https://stripe.com' },
    contentTypes: ['job_listing'],
    iterations: 3,
    pagesVisited: [],
    discoveries: [],
    currentAction: null,
    currentTarget: null,
  };

  it('should fail if no discoveries', () => {
    const result = generateConfig(baseState);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('No discoveries');
  });

  it('should generate config with api_endpoint', () => {
    const state = {
      ...baseState,
      discoveries: [{ type: 'api_endpoint' as const, url: 'https://api.stripe.com/jobs' }],
    };
    const result = generateConfig(state);
    expect(result.success).toBe(true);
    expect(result.config?.url).toBe('https://api.stripe.com/jobs');
    expect(result.config?.parseWith).toBe('json');
    expect(result.config?.method).toBe('GET');
  });

  it('should generate config with webpage and cheerio', () => {
    const state = {
      ...baseState,
      discoveries: [{ type: 'webpage' as const, url: 'https://stripe.com/jobs' }],
    };
    const result = generateConfig(state);
    expect(result.success).toBe(true);
    expect(result.config?.parseWith).toBe('cheerio');
  });

  it('should fail if no valid URL in discoveries', () => {
    const state = {
      ...baseState,
      discoveries: [{ type: 'no_content' as const, reason: 'test' }],
    };
    const result = generateConfig(state);
    expect(result.success).toBe(false);
  });

  it('should fail to generate config if only requires_auth discovery (no valid URL)', () => {
    // requires_auth has URL but it's not usable - generateConfig should fail
    const state = {
      ...baseState,
      discoveries: [{ type: 'requires_auth' as const, url: 'https://api.stripe.com/jobs', requiresAuth: true }],
    };
    const result = generateConfig(state);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('No valid URL');
  });

  it('should set authRequired true when api_endpoint also has requiresAuth', () => {
    // When we have an api_endpoint AND it requires auth, authRequired should be true
    const state = {
      ...baseState,
      discoveries: [
        { type: 'api_endpoint' as const, url: 'https://api.stripe.com/jobs' },
        { type: 'requires_auth' as const, url: 'https://other.com', requiresAuth: true },
      ],
    };
    const result = generateConfig(state);
    expect(result.success).toBe(true);
    expect(result.config?.authRequired).toBe(true);
  });

  it('should calculate confidence based on discoveries', () => {
    const state = {
      ...baseState,
      discoveries: [{ type: 'api_endpoint' as const, url: 'https://api.stripe.com/jobs' }],
    };
    const result = generateConfig(state);
    expect(result.config?.confidence).toBeGreaterThan(50); // Base 50 + 30 for api_endpoint
  });
});

describe('decisionToCommand', () => {
  it('should create NAVIGATE command', () => {
    const decision = { action: 'NAVIGATE' as const, targetUrl: 'https://example.com' };
    const command = decisionToCommand(decision, 'req-123');
    expect(command.type).toBe('NAVIGATE');
    expect(command.requestId).toBe('req-123');
    expect(command.params?.url).toBe('https://example.com');
  });

  it('should create EXTRACT_DOM command', () => {
    const decision = {
      action: 'EXTRACT_DOM' as const,
      targetUrl: 'https://example.com',
      selectors: { title: 'h1' },
    };
    const command = decisionToCommand(decision, 'req-456');
    expect(command.type).toBe('EXTRACT_DOM');
    expect(command.params?.selectors).toEqual({ title: 'h1' });
  });

  it('should create TEST_API command', () => {
    const decision = { action: 'TEST_API' as const, targetUrl: 'https://api.example.com' };
    const command = decisionToCommand(decision, 'req-789');
    expect(command.type).toBe('TEST_API');
    expect(command.params?.url).toBe('https://api.example.com');
  });

  it('should default to NAVIGATE for GENERATE_CONFIG', () => {
    const decision = { action: 'GENERATE_CONFIG' as const };
    const command = decisionToCommand(decision, 'req-000');
    expect(command.type).toBe('NAVIGATE');
  });
});