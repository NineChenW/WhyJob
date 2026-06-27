// src/lib/ai/agents/explorer/fetchconfig-generator.ts

/**
 * Generate FetchConfig from exploration state
 */

import type { ExplorationState, FetchConfig, Discovery, NetworkCall, ContentType } from './types';
import { ExplorationStateWrapper } from './domain';
import { DEFAULT_SELECTORS } from './constants';

/**
 * Generate FetchConfig from exploration state
 */
export function buildFetchConfig(state: ExplorationState): FetchConfig | null {
  const wrapper = new ExplorationStateWrapper(state);

  const task = wrapper.task;
  const discoveries = wrapper.memory.discoveries;
  const networkCalls = wrapper.history.allNetworkCalls;
  const pagesVisited = wrapper.memory.pagesVisited;

  // Find best discovery
  const apiDiscovery = discoveries.find((d) => d.type === 'api_endpoint');
  const webDiscovery = discoveries.find(
    (d) => d.type === 'webpage' || d.type === 'job_data' || d.type === 'culture_data'
  );

  if (!apiDiscovery && !webDiscovery) {
    console.log('[FetchConfig Generator] No valid discoveries');
    return null;
  }

  const primaryType = task.contentTypes[0] || 'job_listing';

  // Prefer API if found
  if (apiDiscovery) {
    return buildApiConfig(apiDiscovery, primaryType, task.companyId, task.companyName, networkCalls);
  }

  // Fall back to web scraping
  return buildWebConfig(
    webDiscovery!,
    primaryType,
    task.companyId,
    task.companyName,
    pagesVisited[0]?.url
  );
}

/**
 * Build FetchConfig for API endpoint
 */
function buildApiConfig(
  discovery: Discovery,
  contentType: ContentType,
  companyId: string,
  companyName: string,
  networkCalls: NetworkCall[]
): FetchConfig {
  const endpoint = (discovery.data as NetworkCall) || { url: discovery.url };
  const url = (endpoint as NetworkCall).url || discovery.url!;

  // Detect pagination from network calls
  const pagination = detectPagination(networkCalls, url);

  // Build headers from observed requests
  const headers = {
    'User-Agent': 'WhyJobBot/1.0',
    Accept: 'application/json',
  };

  // Calculate confidence
  const baseConfidence = discovery.confidence || 70;
  const paginationBoost = pagination ? 10 : 0;
  const confidence = Math.min(95, baseConfidence + paginationBoost);

  return {
    companyId,
    name: `${companyName} - ${contentType} (API)`,
    contentType,
    url,
    method: (endpoint as NetworkCall).method === 'POST' ? 'POST' : 'GET',
    headers,
    params: extractQueryParams(url),
    parseWith: 'json',
    selectors: undefined,
    pagination,
    authRequired: discovery.requiresAuth || false,
    isActive: true,
    intervalHours: 24,
    confidence,
  };
}

/**
 * Build FetchConfig for web scraping
 */
function buildWebConfig(
  discovery: Discovery,
  contentType: ContentType,
  companyId: string,
  companyName: string,
  pageUrl?: string
): FetchConfig {
  const url = discovery.url || pageUrl || '';

  const selectors = buildSelectors(discovery, contentType);

  return {
    companyId,
    name: `${companyName} - ${contentType} (Web)`,
    contentType,
    url,
    method: 'GET',
    headers: { 'User-Agent': 'WhyJobBot/1.0' },
    params: {},
    parseWith: 'cheerio',
    selectors,
    pagination: undefined,
    authRequired: false,
    isActive: true,
    intervalHours: 24 * 7,
    confidence: discovery.confidence || 50,
  };
}

/**
 * Detect pagination from network calls
 */
function detectPagination(
  calls: NetworkCall[],
  baseUrl: string
): FetchConfig['pagination'] | undefined {
  const apiCalls = calls.filter(
    (c) =>
      c.url.startsWith(baseUrl) ||
      (c.url.includes('/api/') && c.url.includes(baseUrl.split('/api/')[1] || ''))
  );

  if (apiCalls.length < 2) return undefined;

  // Look for pagination patterns
  for (const call of apiCalls) {
    const url = new URL(call.url);

    if (url.searchParams.has('page')) {
      return { type: 'page', paramName: 'page', maxPages: 10, increment: 1 };
    }
    if (url.searchParams.has('offset')) {
      return { type: 'offset', paramName: 'offset', maxPages: 50, increment: 20 };
    }
    if (url.searchParams.has('cursor')) {
      return { type: 'cursor', paramName: 'cursor', maxPages: 20 };
    }
  }

  return undefined;
}

/**
 * Extract query parameters from URL
 */
function extractQueryParams(urlString: string): Record<string, string> {
  try {
    const url = new URL(urlString);
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}

/**
 * Build selectors for content extraction
 */
function buildSelectors(discovery: Discovery, contentType: ContentType): Record<string, string> {
  // Use discovered selectors if available
  if (discovery.selectors && Object.keys(discovery.selectors).length > 0) {
    return discovery.selectors;
  }

  // Default selectors by content type
  const defaults = DEFAULT_SELECTORS[contentType];
  if (defaults) {
    return defaults;
  }

  // Generic fallback
  return { content: 'main, article' };
}