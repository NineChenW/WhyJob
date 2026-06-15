/**
 * Explorer Agent - Step-by-Step ACT Loop
 *
 * Designed for HTTP polling where each step is an atomic API call.
 * State is persisted in the FetchTask DB record.
 *
 * Flow:
 * 1. pickup: Marks task as "exploring", returns taskId
 * 2. commands API: Runs ONE iteration, returns command to execute
 * 3. results API: Processes result, updates state, returns next command
 * 4. Repeat until GENERATE_CONFIG or FAIL
 */

import type { Discovery } from '@/lib/db/explorer';
import type { Prisma } from '@prisma/client';
import { testFetchConfig } from '@/lib/fetch';
import type { FetchConfig } from '@prisma/client';

// ============================================
// Types
// ============================================

// Re-export for convenience
export type { FetchConfig } from '@prisma/client';

// ============================================
// Types
// ============================================

export interface TaskState {
  id: string;
  companyId: string;
  company: {
    name: string;
    website?: string;
    industry?: string;
  };
  contentTypes: string[];
  iterations: number;
  pagesVisited: string[];
  discoveries: Discovery[];
  currentAction?: string | null;
  currentTarget?: string | null;
}

export interface AgentDecision {
  action: 'NAVIGATE' | 'EXTRACT_DOM' | 'TEST_API' | 'GENERATE_CONFIG' | 'FAIL';
  targetUrl?: string;
  selectors?: Record<string, string>;
  reason?: string;
}

export interface AgentResult {
  success: boolean;
  config?: FetchConfigOutput;
  reason?: string;
}

export interface FetchConfigOutput {
  url: string;
  method: 'GET';
  headers: Record<string, string>;
  params: Record<string, string>;
  parseWith: 'json' | 'cheerio';
  selectors?: Record<string, string>;
  pagination?: {
    type: 'offset' | 'cursor' | 'page';
    param: string;
  };
  authRequired: boolean;
  confidence: number;
}

// ============================================
// Constants
// ============================================

const MAX_ITERATIONS = 5;

// ============================================
// Decision Logic
// ============================================

export function decideNextAction(state: TaskState): AgentDecision {
  const { iterations, pagesVisited, discoveries, company } = state;

  console.log(`[decideNextAction] State:`, {
    iterations,
    pagesVisited,
    discoveriesCount: discoveries.length,
    company: company.name,
    website: company.website,
  });

  // Rule 1: First iteration - navigate to company website
  if (iterations === 0 && pagesVisited.length === 0) {
    const startUrl = company.website
      ? cleanUrl(company.website)
      : `https://www.google.com/search?q=${encodeURIComponent(company.name + ' careers')}`;

    console.log(`[decideNextAction] Rule 1: First iteration - navigate to ${startUrl}`);
    return {
      action: 'NAVIGATE',
      targetUrl: startUrl,
      reason: 'First iteration - navigate to company website',
    };
  }

  // Rule 2: Check for API endpoints discovered
  const apiDiscovery = discoveries.find((d) => d.type === 'api_endpoint');
  if (apiDiscovery?.url) {
    console.log(`[decideNextAction] Rule 2: Found API endpoint - testing ${apiDiscovery.url}`);
    return {
      action: 'TEST_API',
      targetUrl: apiDiscovery.url,
      reason: 'Found API endpoint - testing it',
    };
  }

  // Rule 3: No content after 2 iterations - fail
  if (discoveries.length === 0 && iterations >= 2) {
    console.log(`[decideNextAction] Rule 3: No content after 2 iterations - FAIL`);
    return {
      action: 'FAIL',
      reason: 'No accessible content found after 2 iterations',
    };
  }

  // Rule 4: Have webpage discoveries - try extraction
  const webpageDiscovery = discoveries.find((d) => d.type === 'webpage');
  if (webpageDiscovery?.url && iterations < 3) {
    const selectors = inferSelectors(state.contentTypes[0]);
    console.log(`[decideNextAction] Rule 4: Extracting DOM from ${webpageDiscovery.url}`);
    return {
      action: 'EXTRACT_DOM',
      targetUrl: webpageDiscovery.url,
      selectors,
      reason: `Extracting content using selectors`,
    };
  }

  // Rule 5: Try careers page
  if (company.website && iterations < MAX_ITERATIONS - 1) {
    const careersUrl = suggestCareersUrl(company.website);
    if (!pagesVisited.includes(careersUrl)) {
      console.log(`[decideNextAction] Rule 5: Trying careers page ${careersUrl}`);
      return {
        action: 'NAVIGATE',
        targetUrl: careersUrl,
        reason: 'Trying careers page',
      };
    }
    console.log(`[decideNextAction] Rule 5: Careers page already visited: ${careersUrl}`);
  }

  // Rule 6: Generate config with what we have
  if (discoveries.length > 0) {
    console.log(`[decideNextAction] Rule 6: Generating config with ${discoveries.length} discoveries`);
    return {
      action: 'GENERATE_CONFIG',
      reason: 'Have discoveries - generating config',
    };
  }

  // Default: fail
  console.log(`[decideNextAction] Default: FAIL - no more pages to try`);
  return {
    action: 'FAIL',
    reason: 'No more pages to try',
  };
}

// ============================================
// Result Analysis
// ============================================

export interface ActionResult {
  success: boolean;
  url?: string;
  title?: string;
  error?: string;
  data?: unknown;
  /** For TEST_API: the raw response data */
  responseData?: unknown;
  /** For TEST_API: HTTP status code */
  statusCode?: number;
}

export function analyzeActionResult(
  action: string,
  result: ActionResult,
  decision: AgentDecision
): Discovery | null {
  if (!result.success) {
    return {
      type: 'no_content',
      reason: result.error || 'Action failed',
    };
  }

  switch (action) {
    case 'NAVIGATE':
      if (result.url) {
        return {
          type: 'webpage',
          url: result.url,
          data: { title: result.title },
        };
      }
      return {
        type: 'no_content',
        reason: 'Navigation returned no URL',
      };

    case 'EXTRACT_DOM':
      if (result.data && Object.keys(result.data as object).length > 0) {
        return {
          type: 'webpage',
          url: decision.targetUrl,
          data: result.data,
          selectors: decision.selectors,
        };
      }
      return {
        type: 'no_content',
        url: decision.targetUrl,
        reason: 'No content extracted',
      };

    case 'TEST_API':
      // TEST_API success means the endpoint works
      if (result.responseData && result.statusCode === 200) {
        return {
          type: 'api_endpoint',
          url: decision.targetUrl,
          data: result.responseData,
          requiresAuth: false,
        };
      }
      // Check for auth issues
      if (result.statusCode === 401 || result.statusCode === 403) {
        return {
          type: 'requires_auth',
          url: decision.targetUrl,
          reason: `Authentication required: ${result.statusCode}`,
          requiresAuth: true,
        };
      }
      return {
        type: 'no_content',
        url: decision.targetUrl,
        reason: result.error || `API returned ${result.statusCode}`,
      };

    default:
      return null;
  }
}

// ============================================
// Config Generation
// ============================================

export function generateConfig(state: TaskState): AgentResult {
  const { discoveries, company, contentTypes } = state;

  if (discoveries.length === 0) {
    return {
      success: false,
      reason: 'No discoveries to generate config from',
    };
  }

  const url = pickBestUrl(discoveries);
  if (!url) {
    return {
      success: false,
      reason: 'No valid URL found in discoveries',
    };
  }

  const parseWith = inferParseMethod(discoveries);
  const selectors = buildSelectors(discoveries);
  const pagination = inferPagination();
  const authRequired = discoveries.some((d) => d.requiresAuth);
  const confidence = calculateConfidence(discoveries);

  return {
    success: true,
    config: {
      url,
      method: 'GET',
      headers: { 'User-Agent': 'WhyJobBot/1.0' },
      params: {},
      parseWith,
      selectors,
      pagination,
      authRequired,
      confidence,
    },
  };
}

function pickBestUrl(discoveries: Discovery[]): string | null {
  const apiDiscovery = discoveries.find((d) => d.type === 'api_endpoint');
  if (apiDiscovery?.url) return apiDiscovery.url;

  const webpageDiscovery = discoveries.find((d) => d.type === 'webpage');
  if (webpageDiscovery?.url) return webpageDiscovery.url;

  return null;
}

function inferParseMethod(discoveries: Discovery[]): 'json' | 'cheerio' {
  const hasApi = discoveries.some((d) => d.type === 'api_endpoint');
  return hasApi ? 'json' : 'cheerio';
}

function buildSelectors(discoveries: Discovery[]): Record<string, string> {
  const extractedSelectors: Record<string, string> = {};

  for (const discovery of discoveries) {
    if (discovery.selectors) {
      Object.assign(extractedSelectors, discovery.selectors);
    }
  }

  if (Object.keys(extractedSelectors).length === 0) {
    return {
      title: 'h1, .title, [class*="title"]',
      content: 'main, .content, [class*="content"]',
      link: 'a[href]',
    };
  }

  return extractedSelectors;
}

function inferPagination(): { type: 'offset' | 'cursor' | 'page'; param: string } {
  return { type: 'page', param: 'page' };
}

function calculateConfidence(discoveries: Discovery[]): number {
  if (discoveries.length === 0) return 0;

  let confidence = 50;

  if (discoveries.some((d) => d.type === 'api_endpoint')) {
    confidence += 30;
  }

  if (discoveries.some((d) => d.type === 'webpage' && d.selectors)) {
    confidence += 20;
  }

  if (discoveries.some((d) => d.type === 'requires_auth')) {
    confidence -= 20;
  }

  if (discoveries.some((d) => d.type === 'no_content')) {
    confidence -= 10;
  }

  return Math.max(0, Math.min(100, confidence));
}

// ============================================
// Utility Functions
// ============================================

export function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname;
    if (pathname.length > 0 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return url;
  }
}

export function suggestCareersUrl(website: string): string {
  const base = cleanUrl(website);
  const careersPaths = ['/careers', '/jobs', '/work-with-us'];

  for (const path of careersPaths) {
    return `${base}${path}`;
  }

  return `${base}/careers`;
}

function inferSelectors(contentType: string): Record<string, string> {
  switch (contentType) {
    case 'job_listing':
    case 'jobs':
    case 'careers':
      return {
        title: 'h1, .job-title, [class*="title"]',
        location: '.location, [class*="location"]',
        description: '.description, [class*="description"]',
        link: 'a[href*="/jobs/"], a[href*="/position/"]',
      };
    case 'company_culture':
    case 'culture':
      return {
        title: 'h1, .culture-title',
        content: '.culture-content, [class*="culture"]',
        values: '.values li, [class*="value"]',
      };
    default:
      return {
        title: 'h1',
        content: 'main, article, .content',
      };
  }
}

// ============================================
// Command Formatting (for extension)
// ============================================

export interface ExtensionCommand {
  type: 'NAVIGATE' | 'EXTRACT_DOM' | 'TEST_API';
  requestId: string;
  params?: Record<string, unknown>;
}

/**
 * Test an API endpoint using the config tester
 * Returns test result for the results API to process
 */
export async function testApiEndpoint(
  url: string,
  timeout = 10000
): Promise<ActionResult> {
  // Build a minimal FetchConfig for testing
  const mockConfig = {
    id: 'test',
    companyId: 'test',
    name: 'API Test',
    contentType: 'job_listing',
    url,
    method: 'GET',
    headers: {} as Record<string, string>,
    params: {} as Record<string, string>,
    parseWith: 'json' as const,
    selectors: null,
    pagination: null,
    authRequired: false,
    authNote: null,
    isActive: true,
    intervalHours: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies FetchConfig;

  const result = await testFetchConfig(mockConfig, { timeout });

  return {
    success: result.success,
    url: result.url,
    error: result.error,
    responseData: result.data,
    statusCode: result.statusCode,
  };
}

export function decisionToCommand(
  decision: AgentDecision,
  requestId: string
): ExtensionCommand {
  switch (decision.action) {
    case 'NAVIGATE':
      return {
        type: 'NAVIGATE',
        requestId,
        params: { url: decision.targetUrl },
      };

    case 'EXTRACT_DOM':
      return {
        type: 'EXTRACT_DOM',
        requestId,
        params: { selectors: decision.selectors },
      };

    case 'TEST_API':
      return {
        type: 'TEST_API',
        requestId,
        params: { url: decision.targetUrl },
      };

    default:
      // GENERATE_CONFIG and FAIL don't produce commands
      return {
        type: 'NAVIGATE',
        requestId,
        params: { url: decision.targetUrl },
      };
  }
}