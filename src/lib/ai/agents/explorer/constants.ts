// src/lib/ai/agents/explorer/constants.ts

/**
 * Explorer Agent Constants
 */

// ============================================
// Iteration Control
// ============================================

export const EXPLORER_CONSTANTS = {
  DEFAULT_MAX_ITERATIONS: 5,
  MIN_ITERATIONS_BEFORE_FAIL: 2,
  MAX_CONSECUTIVE_ERRORS: 3,

  // Timing (ms)
  ACTION_TIMEOUT_MS: 30000,
  LLM_TIMEOUT_MS: 10000,
  POLL_INTERVAL_MS: 500,

  // Confidence thresholds
  HIGH_CONFIDENCE: 70,
  MEDIUM_CONFIDENCE: 50,
  LOW_CONFIDENCE: 30,

  // Confidence adjustments
  CONFIDENCE_BOOST_API: 15,
  CONFIDENCE_PENALTY_ERROR: 15,
  CONFIDENCE_PENALTY_LOW: 10,
} as const;

// ============================================
// Termination Reasons (Domain Constants)
// ============================================

export const TERMINATION_REASON = {
  GENERATE_CONFIG: 'generate_config' as const,
  FAIL: 'fail' as const,
  MAX_ITERATIONS: 'max_iterations' as const,
} as const;

export type TerminationReason = typeof TERMINATION_REASON[keyof typeof TERMINATION_REASON];

// ============================================
// Exploration Actions
// ============================================

export const EXPLORATION_ACTION = {
  NAVIGATE: 'NAVIGATE',
  GET_SNAPSHOT: 'GET_SNAPSHOT',
  EXTRACT_DOM: 'EXTRACT_DOM',
  EXECUTE_JS: 'EXECUTE_JS',
  START_NETWORK_MONITORING: 'START_NETWORK_MONITORING',
  GET_NETWORK_LOG: 'GET_NETWORK_LOG',
  STOP_NETWORK_MONITORING: 'STOP_NETWORK_MONITORING',
  ANALYZE_DATA: 'ANALYZE_DATA',
  TEST_API: 'TEST_API',
  GENERATE_CONFIG: 'GENERATE_CONFIG',
  FAIL: 'FAIL',
  REFLECT: 'REFLECT',
} as const;

// ============================================
// Discovery Types
// ============================================

export const DISCOVERY_TYPE = {
  API_ENDPOINT: 'api_endpoint',
  WEBPAGE: 'webpage',
  JOB_DATA: 'job_data',
  CULTURE_DATA: 'culture_data',
  REQUIRES_AUTH: 'requires_auth',
  JAVASCRIPT_REQUIRED: 'javascript_required',
  NO_CONTENT: 'no_content',
} as const;

// ============================================
// Exploration Status
// ============================================

export const EXPLORATION_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  MAX_ITERATIONS: 'max_iterations',
} as const;

// ============================================
// Tool Call Status
// ============================================

export const TOOL_CALL_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// ============================================
// Exploration actions that don't require tool execution
// ============================================

export const TERMINAL_ACTIONS = ['GENERATE_CONFIG', 'FAIL'] as const;

/**
 * Actions that need URL target
 */
export const URL_ACTIONS = ['NAVIGATE'] as const;

/**
 * Content type to selector mapping defaults
 */
export const DEFAULT_SELECTORS: Record<string, Record<string, string>> = {
  job_listing: {
    container: '.job, .position, .careers-list, [class*="job"]',
    title: 'h2, h3, .title, [class*="title"]',
    company: '.company, [class*="company"]',
    location: '.location, [class*="location"]',
    url: 'a[href*="job"], a[href*="position"]',
  },
  company_culture: {
    container: 'main, article, .about, .culture',
    values: '[class*="value"], [class*="mission"]',
    benefits: '[class*="benefit"], [class*="perk"]',
  },
  company_wechat: {
    wechatId: '.wechat, [class*="wechat"]',
    qrCode: 'img[src*="wechat"]',
  },
};