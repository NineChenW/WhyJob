// src/lib/ai/agents/explorer/constants.ts

/**
 * Explorer Agent Constants
 */
export const EXPLORER_CONSTANTS = {
  // Iteration control
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

/**
 * Exploration actions that don't require tool execution
 */
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