# Explorer Agent - FetchConfig Generator Spec

## Overview

FetchConfig Generator transforms exploration discoveries into actionable fetch configurations for automated data collection. It consumes the structured output from Chrome Extension tool invocations through the observe_result node.

**Iteration 3 Scope**: Generate FetchConfig from tool output discoveries, with pagination detection from network calls, selector building, and confidence scoring.

## Discovery Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Chrome Extension Tool Output                              │
│                                                                              │
│  Tool: NAVIGATE        → { success, url, title }                            │
│  Tool: GET_SNAPSHOT    → { url, title, html, visibleText, networkCalls[] }  │
│  Tool: EXTRACT_DOM     → { url, elements{} }                               │
│  Tool: EXECUTE_JS      → { success, output, duration }                      │
│  Tool: GET_NETWORK_LOG → { calls[], count, monitoringId }                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        observe_result Node                                   │
│                                                                              │
│  Parse Tool Output:                                                          │
│  - Detect API endpoints from network calls                                   │
│  - Detect job/culture content from HTML                                      │
│  - Extract structured data from DOM                                          │
│                                                                              │
│  Output:                                                                      │
│  - discoveries[] → Discovery[]                                               │
│  - networkCalls[] → NetworkCall[]                                            │
│  - pageVisit[] → PageVisit[]                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FetchConfig Generator                                 │
│                                                                              │
│  Input:                                                                      │
│  - discoveries: API endpoints, job data, webpage data                       │
│  - networkCalls: Captured HTTP calls with URLs, methods, statuses           │
│  - company/companyId: Target company context                               │
│  - contentTypes: What we're trying to fetch                                 │
│                                                                              │
│  Output:                                                                     │
│  - FetchConfig: Ready-to-use configuration for data fetching               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Discovery Types

```typescript
// src/lib/ai/agents/explorer/types.ts

export type DiscoveryType =
  | 'api_endpoint'      // JSON API discovered
  | 'webpage'          // DOM elements extracted
  | 'job_data'         // Job listings detected
  | 'culture_data'     // Culture content found
  | 'requires_auth'    // Auth required
  | 'javascript_required' // JS needed to load content
  | 'no_content';      // No useful data

export interface Discovery {
  id: string;
  type: DiscoveryType;
  url?: string;          // Source URL
  data?: unknown;        // Extracted data (JSON, elements, etc.)
  selectors?: Record<string, string>;  // CSS selectors if applicable
  requiresAuth?: boolean;
  reason?: string;
  confidence: number;    // 0-100
  timestamp: Date;
  metadata?: {
    responseType?: string;
    statusCode?: number;
    contentType?: string;
    parseHint?: string;
  };
}

export interface NetworkCall {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  status: number;
  responseType: 'xhr' | 'fetch' | 'document' | 'other';
  timing: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;  // First 10KB
  timestamp: Date;
}
```

## Tool Output Schema Reference

### NAVIGATE Output

```typescript
interface NavigateResult {
  success: boolean;
  url: string;
  title: string;
  error?: string;
}
```

### GET_SNAPSHOT Output

```typescript
interface SnapshotResult {
  url: string;
  title: string;
  html: string;           // Full HTML
  visibleText: string;    // First 5000 chars of text
  networkCalls: Array<{
    id: string;
    url: string;
    method: string;
    status: number;
    responseType: string;
    timing: number;
  }>;
  timestamp: string;
}
```

### EXTRACT_DOM Output

```typescript
interface ExtractResult {
  url: string;
  elements: Record<string, Array<{
    tag: string;
    text: string;       // innerText, max 200 chars
    href?: string;      // if anchor
    src?: string;       // if img
    rect?: { x: number; y: number; width: number; height: number };
  }>>;
}
```

### GET_NETWORK_LOG Output

```typescript
interface NetworkLogResult {
  calls: Array<{
    id: string;
    url: string;
    method: string;
    status: number;
    responseType: string;
    timing: number;
    requestHeaders: Record<string, string>;
    responseHeaders: Record<string, string>;
    responseBody?: string;  // First 10KB
    timestamp: string;
  }>;
  count: number;
  hasMore: boolean;
  monitoringId: string;
}
```

## Discovery Extraction

```typescript
// src/lib/ai/agents/explorer/result-parser.ts

import type { Discovery, NetworkCall } from './types';

/**
 * Parse tool output into discoveries and network calls
 */
export function parseToolResult(
  action: string,
  output: unknown,
  error?: string
): ToolParseResult {
  if (error) {
    return {
      observation: `Error: ${error}`,
      discoveries: [],
      networkCalls: [],
    };
  }

  const result = output as Record<string, unknown>;

  switch (action) {
    case 'GET_SNAPSHOT':
      return parseSnapshotResult(result);
    case 'GET_NETWORK_LOG':
      return parseNetworkLogResult(result);
    case 'EXTRACT_DOM':
      return parseExtractResult(result);
    case 'NAVIGATE':
      return parseNavigateResult(result);
    default:
      return { observation: `Action ${action} completed`, discoveries: [], networkCalls: [] };
  }
}

function parseSnapshotResult(result: Record<string, unknown>) {
  const discoveries: Discovery[] = [];
  const networkCalls: NetworkCall[] = [];

  // Extract network calls from snapshot
  const rawCalls = result.networkCalls as Array<Record<string, unknown>> | undefined;
  if (rawCalls) {
    for (const call of rawCalls) {
      networkCalls.push({
        id: call.id as string || generateId(),
        url: call.url as string,
        method: (call.method as string) as NetworkCall['method'],
        status: call.status as number,
        responseType: (call.responseType as string) as NetworkCall['responseType'],
        timing: call.timing as number || 0,
        timestamp: new Date(),
      });
    }
  }

  // Detect job content
  const html = result.html as string || '';
  const visibleText = result.visibleText as string || '';

  if (containsJobContent(html, visibleText)) {
    discoveries.push({
      id: generateId(),
      type: 'job_data',
      url: result.url as string,
      data: { text: visibleText.slice(0, 3000) },
      confidence: 70,
      timestamp: new Date(),
      metadata: { parseHint: 'job_keyword_detection' },
    });
  }

  // Detect API endpoints in network calls
  for (const call of networkCalls) {
    if (isApiEndpoint(call.url) && call.status >= 200 && call.status < 400) {
      discoveries.push({
        id: generateId(),
        type: 'api_endpoint',
        url: call.url,
        data: { method: call.method, status: call.status },
        confidence: 85,
        timestamp: new Date(),
        metadata: {
          responseType: call.responseType,
          statusCode: call.status,
          parseHint: 'json_api',
        },
      });
    }
  }

  return {
    observation: `Snapshot: ${visibleText.length} chars, ${networkCalls.length} network calls, ${discoveries.length} discoveries`,
    discoveries,
    networkCalls,
    currentUrl: result.url as string,
  };
}

function parseNetworkLogResult(result: Record<string, unknown>) {
  const discoveries: Discovery[] = [];
  const rawCalls = result.calls as Array<Record<string, unknown>> | undefined;
  const calls: NetworkCall[] = [];

  if (rawCalls) {
    for (const call of rawCalls) {
      const networkCall: NetworkCall = {
        id: call.id as string || generateId(),
        url: call.url as string,
        method: (call.method as string) as NetworkCall['method'],
        status: call.status as number,
        responseType: (call.responseType as string) as NetworkCall['responseType'],
        timing: call.timing as number || 0,
        responseBody: call.responseBody as string | undefined,
        timestamp: new Date(),
      };
      calls.push(networkCall);

      // Extract API endpoints
      if (isApiEndpoint(call.url) && call.status >= 200 && call.status < 400) {
        discoveries.push({
          id: generateId(),
          type: 'api_endpoint',
          url: call.url,
          data: networkCall,
          confidence: 90,  // Higher confidence for explicit network capture
          timestamp: new Date(),
          metadata: {
            responseType: call.responseType as string,
            statusCode: call.status as number,
            parseHint: 'json_api',
          },
        });
      }
    }
  }

  const apiCount = discoveries.filter(d => d.type === 'api_endpoint').length;

  return {
    observation: `Network log: ${calls.length} calls captured, ${apiCount} API endpoints found`,
    discoveries,
    networkCalls: calls,
    monitoringId: result.monitoringId as string,
  };
}

function parseExtractResult(result: Record<string, unknown>) {
  const elements = result.elements as Record<string, Array<Record<string, unknown>>>;
  const count = elements ? Object.values(elements).flat().length : 0;

  const discoveries: Discovery[] = [];
  if (elements && count > 0) {
    discoveries.push({
      id: generateId(),
      type: 'webpage',
      url: result.url as string,
      data: elements,
      selectors: Object.fromEntries(
        Object.keys(elements).map(key => [key, key]) // Use keys as selectors for retry
      ),
      confidence: 75,
      timestamp: new Date(),
    });
  }

  return {
    observation: `Extracted ${count} elements`,
    discoveries,
    networkCalls: [],
  };
}

function parseNavigateResult(result: Record<string, unknown>) {
  return {
    observation: result.success
      ? `Navigated to ${result.url}`
      : `Navigation failed: ${result.error}`,
    discoveries: [],
    networkCalls: [],
    currentUrl: result.url as string,
  };
}

// Helper functions
function containsJobContent(html: string, text: string): boolean {
  const patterns = [/job/i, /career/i, /position/i, /hiring/i, /open role/i, /vacancy/i];
  return patterns.some(p => p.test(html) || p.test(text));
}

function isApiEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return (
      path.includes('/api/') ||
      path.includes('/jobs') ||
      path.includes('/positions') ||
      path.includes('/careers') ||
      parsed.searchParams.has('q') ||
      parsed.searchParams.has('query') ||
      parsed.searchParams.has('search')
    );
  } catch {
    return false;
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

## FetchConfig Generator

```typescript
// src/lib/ai/agents/explorer/fetchconfig-generator.ts

import type { ExplorationState, FetchConfig, Discovery, NetworkCall, ContentType } from './types';

/**
 * Generate FetchConfig from exploration state
 */
export function buildFetchConfig(state: ExplorationState): FetchConfig | null {
  const { taskId, company, contentTypes, discoveries, networkCalls, pagesVisited } = state;

  // Find best discovery
  const apiDiscovery = discoveries.find(d => d.type === 'api_endpoint');
  const webDiscovery = discoveries.find(d =>
    d.type === 'webpage' || d.type === 'job_data' || d.type === 'culture_data'
  );

  if (!apiDiscovery && !webDiscovery) {
    console.log('[FetchConfig Generator] No valid discoveries');
    return null;
  }

  const primaryType = contentTypes[0];

  // Prefer API if found
  if (apiDiscovery) {
    return buildApiConfig(apiDiscovery, primaryType, company.id, company.name, networkCalls);
  }

  // Fall back to web scraping
  return buildWebConfig(webDiscovery, primaryType, company.id, company.name, pagesVisited[0]?.url);
}
```

### API Config Builder

```typescript
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
    'Accept': 'application/json',
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
    intervalHours: 24,  // Daily for job listings
    confidence,
  };
}

function detectPagination(calls: NetworkCall[], baseUrl: string): FetchConfig['pagination'] | undefined {
  const apiCalls = calls.filter(c =>
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

function extractQueryParams(urlString: string): Record<string, string> {
  try {
    const url = new URL(urlString);
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => { params[key] = value; });
    return params;
  } catch {
    return {};
  }
}
```

### Web Config Builder

```typescript
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
    intervalHours: 24 * 7,  // Weekly for web scraping
    confidence: discovery.confidence || 50,
  };
}

function buildSelectors(discovery: Discovery, contentType: ContentType): Record<string, string> {
  // Use discovered selectors if available
  if (discovery.selectors && Object.keys(discovery.selectors).length > 0) {
    return discovery.selectors;
  }

  // Default selectors by content type
  switch (contentType) {
    case 'job_listing':
      return {
        container: '.job, .position, .careers-list, [class*="job"]',
        title: 'h2, h3, .title, [class*="title"]',
        company: '.company, [class*="company"]',
        location: '.location, [class*="location"]',
        url: 'a[href*="job"], a[href*="position"]',
      };
    case 'company_culture':
      return {
        container: 'main, article, .about, .culture',
        values: '[class*="value"], [class*="mission"]',
        benefits: '[class*="benefit"], [class*="perk"]',
      };
    case 'company_wechat':
      return {
        wechatId: '.wechat, [class*="wechat"]',
        qrCode: 'img[src*="wechat"]',
      };
    default:
      return { content: 'main, article' };
  }
}
```

## FetchConfig Schema

```typescript
// src/lib/ai/agents/explorer/types.ts (additional)

export interface FetchConfig {
  companyId: string;
  name: string;
  contentType: ContentType;
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  params: Record<string, string>;
  parseWith: 'json' | 'cheerio';
  selectors?: Record<string, string>;
  pagination?: {
    type: 'page' | 'offset' | 'cursor';
    paramName: string;
    maxPages: number;
    increment?: number;
    stopCondition?: string;
  };
  authRequired: boolean;
  authNote?: string;
  isActive: boolean;
  intervalHours?: number;
  confidence: number;
}
```

## Confidence Calculation

```typescript
function calculateConfigConfidence(
  discovery: Discovery,
  networkCalls: NetworkCall[]
): number {
  let confidence = discovery.confidence || 50;

  // Boost for API endpoint
  if (discovery.type === 'api_endpoint') {
    confidence += 15;

    // Check if we have pagination info
    const hasPagination = networkCalls.some(c =>
      new URL(c.url).searchParams.has('page') ||
      new URL(c.url).searchParams.has('offset') ||
      new URL(c.url).searchParams.has('cursor')
    );
    if (hasPagination) confidence += 10;
  }

  // Boost for JSON response
  if (discovery.metadata?.parseHint === 'json_api') {
    confidence += 10;
  }

  // Cap at 95%
  return Math.min(95, confidence);
}
```

## Reference

- `@docs/ai-assist-fetch-info-plan.md` - Full system design
- `@context/features/explorer-agent-06-ai-exploration-agent-spec.md` - Main exploration spec
- `@context/features/explorer-agent-08-exploration-loop-spec.md` - Exploration loop
- `@context/features/explorer-agent-03-server-integration-spec.md` - FetchConfig model

## Notes

- API configs preferred over web scraping (higher confidence)
- Pagination detection requires network calls with pagination parameters
- Selectors are content-type specific for better extraction
- Confidence reflects data source quality and reliability