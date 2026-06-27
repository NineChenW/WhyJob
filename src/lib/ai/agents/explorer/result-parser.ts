// src/lib/ai/agents/explorer/result-parser.ts

import type { ExplorationState, Discovery, NetworkCall, PageVisit, ContentType } from './types';

/**
 * Tool parse result
 */
export interface ToolParseResult {
  observation: string;
  pageVisit?: PageVisit;
  discoveries: Discovery[];
  networkCalls: NetworkCall[];
  currentUrl?: string;
  monitoringId?: string;
}

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

  if (output === undefined || output === null) {
    return {
      observation: `No output received for ${action}`,
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
    case 'START_NETWORK_MONITORING':
      return {
        observation: result.success ? 'Network monitoring started' : 'Failed to start monitoring',
        discoveries: [],
        networkCalls: [],
        monitoringId: result.monitoringId as string,
      };
    case 'STOP_NETWORK_MONITORING':
      return {
        observation: `Network monitoring stopped. Captured ${result.totalCallsCaptured || 0} calls`,
        discoveries: [],
        networkCalls: [],
      };
    case 'EXECUTE_JS':
      return {
        observation: result.success
          ? `JS executed successfully${result.output ? `: ${result.output}` : ''}`
          : `JS execution failed: ${result.error || 'Unknown error'}`,
        discoveries: [],
        networkCalls: [],
      };
    default:
      return { observation: `Action ${action} completed`, discoveries: [], networkCalls: [] };
  }
}

function parseSnapshotResult(result: Record<string, unknown>): ToolParseResult {
  const discoveries: Discovery[] = [];
  const networkCalls: NetworkCall[] = [];

  // Extract network calls from snapshot
  const rawCalls = result.networkCalls as Array<Record<string, unknown>> | undefined;
  if (rawCalls) {
    for (const call of rawCalls) {
      networkCalls.push({
        id: (call.id as string) || generateId(),
        url: call.url as string,
        method: (call.method as string) as NetworkCall['method'],
        status: call.status as number,
        responseType: (call.responseType as string) as NetworkCall['responseType'],
        timing: (call.timing as number) || 0,
        timestamp: new Date(),
      });
    }
  }

  // Detect job content
  const html = (result.html as string) || '';
  const visibleText = (result.visibleText as string) || '';

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

function parseNetworkLogResult(result: Record<string, unknown>): ToolParseResult {
  const discoveries: Discovery[] = [];
  const rawCalls = result.calls as Array<Record<string, unknown>> | undefined;
  const calls: NetworkCall[] = [];

  if (rawCalls) {
    for (const call of rawCalls) {
      const networkCall: NetworkCall = {
        id: (call.id as string) || generateId(),
        url: call.url as string,
        method: (call.method as string) as NetworkCall['method'],
        status: call.status as number,
        responseType: (call.responseType as string) as NetworkCall['responseType'],
        timing: (call.timing as number) || 0,
        responseBody: call.responseBody as string | undefined,
        timestamp: new Date(),
      };
      calls.push(networkCall);

      // Extract API endpoints
      const callUrl = call.url as string;
      const callStatus = call.status as number;
      if (isApiEndpoint(callUrl) && callStatus >= 200 && callStatus < 400) {
        discoveries.push({
          id: generateId(),
          type: 'api_endpoint',
          url: callUrl,
          data: networkCall,
          confidence: 90,
          timestamp: new Date(),
          metadata: {
            responseType: call.responseType as string,
            statusCode: callStatus,
            parseHint: 'json_api',
          },
        });
      }
    }
  }

  const apiCount = discoveries.filter((d) => d.type === 'api_endpoint').length;

  return {
    observation: `Network log: ${calls.length} calls captured, ${apiCount} API endpoints found`,
    discoveries,
    networkCalls: calls,
    monitoringId: result.monitoringId as string,
  };
}

function parseExtractResult(result: Record<string, unknown>): ToolParseResult {
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
        Object.keys(elements).map((key) => [key, key])
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

function parseNavigateResult(result: Record<string, unknown> | undefined): ToolParseResult {
  // Handle undefined result
  if (!result) {
    return {
      observation: 'Navigation result not available',
      discoveries: [],
      networkCalls: [],
      currentUrl: undefined,
    };
  }

  // Handle both success (with data nested) and error (flat) structures from extension
  // Success: { requestId, success: true, data: { success, url, title } }
  // Error: { requestId, success: false, error: '...' }
  const data = result.data as Record<string, unknown> | undefined;
  const success = (data?.success ?? result.success) as boolean;
  const url = (data?.url ?? result.url) as string | undefined;
  const error = (data?.error ?? result.error) as string | undefined;

  return {
    observation: success
      ? `Navigated to ${url}`
      : `Navigation failed: ${error}`,
    discoveries: [],
    networkCalls: [],
    currentUrl: url,
  };
}

// Helper functions

function containsJobContent(html: string, text: string): boolean {
  const patterns = [/job/i, /career/i, /position/i, /hiring/i, /open role/i, /vacancy/i];
  return patterns.some((p) => p.test(html) || p.test(text));
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