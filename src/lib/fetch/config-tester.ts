/**
 * FetchConfig Tester
 *
 * Tests a FetchConfig by making an actual HTTP request to validate
 * that it works before saving. This ensures the config is reusable
 * for server-side data fetching.
 */

import type { FetchConfig } from '@prisma/client';

export interface FetchConfigTestResult {
  success: boolean;
  url: string;
  method: string;
  statusCode?: number;
  responseTime?: number; // ms

  // Parsed data if successful
  data?: unknown;

  // Error details
  error?: string;
  errorType?: 'network' | 'timeout' | 'parse' | 'auth' | 'unknown';

  // Validation
  isJson?: boolean;
  isHtml?: boolean;
  itemCount?: number; // For paginated responses
}

interface TestOptions {
  timeout?: number; // ms, default 10000
  maxItems?: number; // Max items to sample from response
}

/**
 * Test a FetchConfig by making a request
 */
export async function testFetchConfig(
  config: FetchConfig,
  options: TestOptions = {}
): Promise<FetchConfigTestResult> {
  const { timeout = 10000, maxItems = 10 } = options;
  const startTime = Date.now();

  const result: FetchConfigTestResult = {
    success: false,
    url: config.url,
    method: config.method,
  };

  try {
    // Build URL with params
    const url = new URL(config.url);
    if (config.params && typeof config.params === 'object') {
      Object.entries(config.params as Record<string, string>).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    // Build headers
    const headers: Record<string, string> = {
      'User-Agent': 'WhyJobBot/1.0',
      ...(typeof config.headers === 'object' ? config.headers as Record<string, string> : {}),
    };

    // Make the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url.toString(), {
      method: config.method,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    result.responseTime = Date.now() - startTime;
    result.statusCode = response.status;

    // Check for auth errors
    if (response.status === 401 || response.status === 403) {
      result.success = false;
      result.errorType = 'auth';
      result.error = `Authentication error: ${response.status}`;
      return result;
    }

    // Check for redirect (might indicate wrong URL)
    if (response.status >= 300 && response.status < 400) {
      result.success = false;
      result.errorType = 'network';
      result.error = `Redirected to ${response.headers.get('location') || 'unknown location'}`;
      return result;
    }

    // Check for client/server errors
    if (!response.ok) {
      result.success = false;
      result.errorType = 'network';
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    // Get content type
    const contentType = response.headers.get('content-type') || '';
    result.isJson = contentType.includes('json');
    result.isHtml = contentType.includes('html');

    // Parse response based on config.parseWith
    if (config.parseWith === 'json') {
      const json = await response.json();
      result.data = json;
      result.itemCount = Array.isArray(json) ? Math.min(json.length, maxItems) : 1;
      result.success = true;
    } else {
      // cheerio - just get the HTML for now, actual parsing would happen during fetch
      const html = await response.text();
      result.data = html;
      result.isHtml = true;
      // For HTML, we can't easily count items without parsing
      result.itemCount = undefined;
      result.success = true;
    }

    return result;
  } catch (error) {
    result.responseTime = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        result.errorType = 'timeout';
        result.error = `Request timed out after ${timeout}ms`;
      } else {
        result.errorType = 'network';
        result.error = error.message;
      }
    } else {
      result.errorType = 'unknown';
      result.error = 'Unknown error occurred';
    }

    result.success = false;
    return result;
  }
}

/**
 * Validate parsed data structure matches expectations
 */
export function validateParsedData(
  data: unknown,
  config: FetchConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // For JSON parsing, we expect an object or array
  if (config.parseWith === 'json') {
    if (!data || typeof data !== 'object') {
      errors.push('Expected JSON object or array, got something else');
    } else if (Array.isArray(data)) {
      // Arrays are valid for JSON parseWith
    } else if (typeof data === 'object') {
      // Objects are valid
    } else {
      errors.push('Expected JSON object or array');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Test pagination by fetching multiple pages
 */
export async function testPagination(
  config: FetchConfig,
  maxPages = 3
): Promise<{
  works: boolean;
  testedPages: number;
  itemsPerPage: number[];
  errors: string[];
}> {
  const itemsPerPage: number[] = [];
  const errors: string[] = [];
  let testedPages = 0;

  for (let page = 1; page <= maxPages; page++) {
    // Build URL with pagination param
    const url = new URL(config.url);
    const paginationParam = (config.pagination as { param?: string })?.param || 'page';
    url.searchParams.set(paginationParam, String(page));

    const pageConfig: FetchConfig = {
      ...config,
      url: url.toString(),
    };

    const result = await testFetchConfig(pageConfig);

    if (!result.success) {
      errors.push(`Page ${page}: ${result.error}`);
      break;
    }

    if (result.itemCount !== undefined) {
      itemsPerPage.push(result.itemCount);
    }

    testedPages++;
  }

  return {
    works: testedPages > 0 && errors.length === 0,
    testedPages,
    itemsPerPage,
    errors,
  };
}

/**
 * Full test suite for a FetchConfig
 */
export interface FetchConfigTestSuite {
  basic: FetchConfigTestResult;
  pagination?: {
    works: boolean;
    testedPages: number;
    itemsPerPage: number[];
    errors: string[];
  };
  validation: {
    valid: boolean;
    errors: string[];
  };
}

export async function runFullConfigTest(
  config: FetchConfig
): Promise<FetchConfigTestSuite> {
  // Basic test
  const basic = await testFetchConfig(config);

  // Pagination test if pagination is configured
  let pagination;
  if (config.pagination) {
    pagination = await testPagination(config);
  }

  // Validation
  const validation = basic.data
    ? validateParsedData(basic.data, config)
    : { valid: false, errors: basic.error ? [basic.error] : ['No data to validate'] };

  return {
    basic,
    pagination,
    validation,
  };
}