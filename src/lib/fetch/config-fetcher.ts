/**
 * Config Fetcher
 *
 * Uses a FetchConfig to fetch data from a company's website.
 * This is the server-side fetching that runs on a schedule
 * using the approved configuration.
 */

import type { FetchConfig } from '@prisma/client';

export interface FetchResult {
  success: boolean;
  data?: unknown;
  error?: string;
  fetchedAt: Date;
  responseTime: number;
  itemCount?: number;
}

interface FetchOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Fetch data using a FetchConfig
 */
export async function fetchWithConfig(
  config: FetchConfig,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const { timeout = 30000, headers: customHeaders } = options;
  const startTime = Date.now();

  try {
    // Build URL with params
    const url = new URL(config.url);
    if (config.params && typeof config.params === 'object') {
      Object.entries(config.params as Record<string, string>).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    // Merge headers
    const defaultHeaders: Record<string, string> = {
      'User-Agent': 'WhyJobBot/1.0',
    };
    const configHeaders = typeof config.headers === 'object'
      ? (config.headers as Record<string, string>)
      : {};
    const headers = { ...defaultHeaders, ...configHeaders, ...customHeaders };

    // Make request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url.toString(), {
      method: config.method,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        fetchedAt: new Date(),
        responseTime,
      };
    }

    // Parse response
    let data: unknown;
    let itemCount: number | undefined;

    if (config.parseWith === 'json') {
      data = await response.json();
      if (Array.isArray(data)) {
        itemCount = data.length;
      } else if (data && typeof data === 'object') {
        itemCount = 1;
      }
    } else {
      // For cheerio, return raw HTML - actual parsing happens in a separate step
      data = await response.text();
    }

    return {
      success: true,
      data,
      fetchedAt: new Date(),
      responseTime,
      itemCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      fetchedAt: new Date(),
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Fetch data with pagination support
 */
export async function fetchWithConfigPaginated(
  config: FetchConfig,
  options: FetchOptions & {
    maxPages?: number;
    pageParam?: string;
  } = {}
): Promise<FetchResult[]> {
  const { maxPages = 10, pageParam = 'page' } = options;
  const results: FetchResult[] = [];

  const pagination = config.pagination as { type?: string; param?: string } | undefined;
  const paginationParam = pagination?.param || pageParam;

  for (let page = 1; page <= maxPages; page++) {
    // Build URL with page param
    const url = new URL(config.url);
    url.searchParams.set(paginationParam, String(page));

    const pageConfig: FetchConfig = {
      ...config,
      url: url.toString(),
    };

    const result = await fetchWithConfig(pageConfig, options);
    results.push(result);

    // Stop if we got no data
    if (!result.success || result.itemCount === 0) {
      break;
    }
  }

  return results;
}

/**
 * Fetch multiple configs for a company
 */
export async function fetchCompanyData(
  configs: FetchConfig[]
): Promise<Record<string, FetchResult>> {
  const results: Record<string, FetchResult> = {};

  // Fetch all configs in parallel
  const promises = configs.map(async (config) => {
    const result = await fetchWithConfig(config);
    return { configId: config.id, result };
  });

  const settled = await Promise.all(promises);

  for (const { configId, result } of settled) {
    results[configId] = result;
  }

  return results;
}