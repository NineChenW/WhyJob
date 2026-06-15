/**
 * Explorer Agent - Core Loop Implementation
 *
 * Runs an ACT loop (Observe → Think → Act → Observe) to explore company websites
 * and generate FetchConfig. Controls Chrome Extension via WebSocket.
 *
 * Iteration 1 Scope: Basic ACT loop with max 5 iterations, simple decision logic.
 */

// ============================================
// Logging
// ============================================

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  phase: string;
  message: string;
  data?: unknown;
}

function formatLog(level: LogLevel, phase: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level}] [${phase}] ${message}`;
  if (data !== undefined) {
    return `${base}\n  Data: ${JSON.stringify(data, null, 2)}`;
  }
  return base;
}

function log(phase: string, level: LogLevel, message: string, data?: unknown): void {
  const formatted = formatLog(level, phase, message, data);
  if (level === 'ERROR') {
    console.error(formatted);
  } else if (level === 'WARN') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

// Convenience log helpers
const logInfo = (phase: string, message: string, data?: unknown) => log(phase, 'INFO', message, data);
const logWarn = (phase: string, message: string, data?: unknown) => log(phase, 'WARN', message, data);
const logError = (phase: string, message: string, data?: unknown) => log(phase, 'ERROR', message, data);
const logDebug = (phase: string, message: string, data?: unknown) => log(phase, 'DEBUG', message, data);

// ============================================
// Constants
// ============================================

const MAX_ITERATIONS = 5;
const QUALITY_THRESHOLD = 70;
const NETWORK_TIMEOUT = 60000; // 60 seconds total timeout
const COMMAND_LATENCY_DELAY = 2000; // 2 seconds to wait for extension to poll and execute

// ============================================
// Types
// ============================================

export interface ExplorationTask {
  companyId: string;
  company: {
    name: string;
    website?: string;
    industry?: string;
  };
  contentTypes: string[]; // e.g., ['careers', 'jobs', 'culture']
}

export interface ExplorationResult {
  success: boolean;
  config?: FetchConfig;
  reason?: string;
}

export interface ExplorationMemory {
  task: ExplorationTask;
  pagesVisited: string[];
  discoveries: Discovery[];
  iteration: number;
}

export interface Discovery {
  type: 'api_endpoint' | 'webpage' | 'requires_auth' | 'no_content';
  url?: string;
  data?: unknown;
  selectors?: Record<string, string>;
  requiresAuth?: boolean;
  reason?: string;
}

// Decision types - 'NAVIGATE' triggers page load which includes snapshot data
type DecisionAction = 'NAVIGATE' | 'EXTRACT_DOM' | 'TEST_API' | 'GENERATE_CONFIG' | 'FAIL';

export interface Decision {
  action: DecisionAction;
  targetUrl?: string;
  selectors?: Record<string, string>;
  reason?: string;
}

export interface FetchConfig {
  companyId: string;
  contentType: string;
  name: string;
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

// Extension command types
export interface ExtensionCommand {
  type: 'NAVIGATE' | 'GET_SNAPSHOT' | 'EXTRACT_DOM' | 'TEST_API';
  requestId: string;
  params?: Record<string, unknown>;
}

export interface ExtensionResult {
  requestId: string;
  data?: unknown;
  error?: string;
}

// Page snapshot from extension
export interface PageSnapshot {
  url: string;
  title: string;
  html: string;
  visibleText: string;
  networkCalls: Array<{
    url: string;
    method: string;
    status: number;
    responseType: string;
  }>;
  timestamp: Date;
}

// ============================================
// Working Memory Functions
// ============================================

function initializeMemory(task: ExplorationTask): ExplorationMemory {
  logInfo('MEMORY', 'Initializing exploration memory', { companyId: task.companyId, company: task.company, contentTypes: task.contentTypes });
  return {
    task,
    pagesVisited: [],
    discoveries: [],
    iteration: 0,
  };
}

function updateMemory(memory: ExplorationMemory): void {
  // Iteration 1: In-memory only, no persistence
  // Future: updateEpisodicMemory(memory) for persistence
}

// ============================================
// Context Retrieval (Iteration 1: returns empty)
// ============================================

interface PriorKnowledge {
  similarCompanies?: string[];
  successfulStrategies?: string[];
  failedApproaches?: string[];
}

async function retrieveContext(_task: ExplorationTask): Promise<PriorKnowledge> {
  // Iteration 1: No memory/retrieval
  // Iteration 3 will implement: retrieveContext(task) → find similar companies
  return {};
}

// ============================================
// Extension Interface
// ============================================

import type { ExtensionInterface } from './extension-interface';

/**
 * Execute action via Chrome Extension
 */
async function executeAction(
  decision: Decision,
  extension: ExtensionInterface
): Promise<ExtensionResult> {
  logInfo('ACT', `Executing action: ${decision.action}`, { targetUrl: decision.targetUrl, selectors: decision.selectors, reason: decision.reason });

  switch (decision.action) {
    case 'NAVIGATE':
      if (!decision.targetUrl) {
        return { requestId: '', error: 'No URL provided for navigation' };
      }
      const navResult = await extension.navigate(decision.targetUrl);
      return {
        requestId: crypto.randomUUID(),
        data: navResult,
      };

    case 'EXTRACT_DOM':
      if (!decision.selectors) {
        return { requestId: '', error: 'No selectors provided for extraction' };
      }
      const elements = await extension.extractElements(decision.selectors);
      return {
        requestId: crypto.randomUUID(),
        data: elements,
      };

    case 'TEST_API':
      // Will be implemented in Iteration 2
      return {
        requestId: crypto.randomUUID(),
        data: { message: 'TEST_API not implemented in Iteration 1' },
      };

    case 'GENERATE_CONFIG':
    case 'FAIL':
      // These are terminal actions, no execution needed
      return { requestId: crypto.randomUUID(), data: {} };

    default:
      return { requestId: '', error: `Unknown action: ${decision.action}` };
  }
}

// ============================================
// Decision Logic
// ============================================

/**
 * Decide next action based on current state
 *
 * Priority Logic:
 * 1. If iteration === 0 AND no pages visited → NAVIGATE to company URL or careers page
 * 2. If we have API endpoint in discoveries → TEST_API (future) or analyze
 * 3. If we have page HTML in discoveries → ANALYZE and decide: another page or GENERATE_CONFIG
 * 4. If no discoveries after 2 iterations → FAIL (no accessible source)
 */
async function decideNextAction(
  state: {
    task: ExplorationTask;
    iteration: number;
    pagesVisited: string[];
    discoveries: Discovery[];
    priorKnowledge: PriorKnowledge;
  }
): Promise<Decision> {
  const { task, iteration, pagesVisited, discoveries } = state;

  logDebug('THINK', `Deciding next action for iteration ${iteration}`, { pagesVisited, discoveriesCount: discoveries.length });

  // Rule 1: First iteration - navigate to company website
  if (iteration === 0 && pagesVisited.length === 0) {
    const startUrl = task.company.website
      ? cleanUrl(task.company.website)
      : `https://www.google.com/search?q=${encodeURIComponent(task.company.name + ' careers')}`;

    logInfo('THINK', `→ NAVIGATE to ${startUrl}`, { reason: 'First iteration - navigate to company website' });
    return {
      action: 'NAVIGATE',
      targetUrl: startUrl,
      reason: 'First iteration - navigate to company website or search for careers',
    };
  }

  // Rule 2: Check for API endpoints discovered
  const apiDiscovery = discoveries.find((d) => d.type === 'api_endpoint');
  if (apiDiscovery?.url) {
    logInfo('THINK', `→ TEST_API at ${apiDiscovery.url}`, { reason: 'Found API endpoint - testing it' });
    return {
      action: 'TEST_API',
      targetUrl: apiDiscovery.url,
      reason: 'Found API endpoint - testing it',
    };
  }

  // Rule 3: No content after 2 iterations - fail
  if (discoveries.length === 0 && iteration >= 2) {
    logWarn('THINK', '→ FAIL', { reason: 'No accessible content found after 2 iterations' });
    return {
      action: 'FAIL',
      reason: 'No accessible content found after 2 iterations',
    };
  }

  // Rule 4: Have discoveries - use heuristic to decide next step
  if (discoveries.length > 0) {
    const heuristicDecision = decideWithHeuristic(state);
    if (heuristicDecision) {
      logInfo('THINK', `→ ${heuristicDecision.action}`, { targetUrl: heuristicDecision.targetUrl, reason: heuristicDecision.reason });
      return heuristicDecision;
    }
  }

  // Rule 5: Try to find careers/culture page if we have a website
  if (task.company.website && iteration < MAX_ITERATIONS - 1) {
    const careersUrl = suggestCareersUrl(task.company.website);
    if (!pagesVisited.includes(careersUrl)) {
      logInfo('THINK', `→ NAVIGATE to ${careersUrl}`, { reason: 'Trying careers page' });
      return {
        action: 'NAVIGATE',
        targetUrl: careersUrl,
        reason: 'Trying careers page',
      };
    }
  }

  // Default: Generate config with what we have
  logInfo('THINK', '→ GENERATE_CONFIG', { reason: 'Max iterations or no more pages to try' });
  return {
    action: 'GENERATE_CONFIG',
    reason: 'Max iterations or no more pages to try',
  };
}

/**
 * Heuristic-based decision for Iteration 1
 * AI assistance will be added in future iterations
 */
function decideWithHeuristic(
  state: {
    task: ExplorationTask;
    iteration: number;
    pagesVisited: string[];
    discoveries: Discovery[];
    priorKnowledge: PriorKnowledge;
  }
): Decision | null {
  const { task, iteration, pagesVisited, discoveries } = state;

  // If we have a webpage, try to extract content
  const webpageDiscovery = discoveries.find((d) => d.type === 'webpage');
  if (webpageDiscovery?.url && iteration < 3) {
    // Try to find job listings or relevant content
    const selectors = inferSelectors(task.contentTypes[0]);
    return {
      action: 'EXTRACT_DOM',
      targetUrl: webpageDiscovery.url,
      selectors,
      reason: `Extracting content using ${Object.keys(selectors).join(', ')} selectors`,
    };
  }

  // If iteration is getting high, generate config
  if (iteration >= MAX_ITERATIONS - 2) {
    return {
      action: 'GENERATE_CONFIG',
      reason: 'Approaching max iterations - generating config with current discoveries',
    };
  }

  // Look for more pages if we haven't tried many
  if (pagesVisited.length < 3 && task.company.website) {
    const currentBase = new URL(pagesVisited[0] || task.company.website).origin;
    const additionalPages = [
      '/about',
      '/careers',
      '/jobs',
      '/culture',
      '/team',
    ];

    for (const page of additionalPages) {
      const newUrl = currentBase + page;
      if (!pagesVisited.includes(newUrl)) {
        return {
          action: 'NAVIGATE',
          targetUrl: newUrl,
          reason: `Exploring additional page: ${page}`,
        };
      }
    }
  }

  // No more pages to try - generate config
  return {
    action: 'GENERATE_CONFIG',
    reason: 'All reasonable pages explored',
  };
}

// ============================================
// Result Analysis
// ============================================

/**
 * Analyze result from extension command and extract discoveries
 */
function analyzeResult(result: ExtensionResult, decision: Decision): Discovery | null {
  logInfo('OBSERVE', `Analyzing result for action: ${decision.action}`, { requestId: result.requestId, error: result.error });

  // Handle errors
  if (result.error) {
    logWarn('OBSERVE', 'Action returned error', { error: result.error, action: decision.action });
    return {
      type: 'no_content',
      reason: result.error,
    };
  }

  const data = result.data;

  switch (decision.action) {
    case 'NAVIGATE': {
      const navData = data as { success: boolean; url?: string; title?: string } | undefined;
      if (!navData?.success) {
        logWarn('OBSERVE', 'Navigation failed', { url: decision.targetUrl, navData });
        return {
          type: 'no_content',
          url: decision.targetUrl,
          reason: 'Navigation failed',
        };
      }

      // Navigation succeeded - need to get snapshot to analyze
      logInfo('OBSERVE', 'Navigation succeeded, discovered webpage', { url: navData.url || decision.targetUrl, title: navData.title });
      return {
        type: 'webpage',
        url: navData.url || decision.targetUrl,
        data: { title: navData.title },
      };
    }

    case 'EXTRACT_DOM': {
      const elements = data as Record<string, unknown> | undefined;
      if (!elements || Object.keys(elements).length === 0) {
        logWarn('OBSERVE', 'No content extracted with selectors', { url: decision.targetUrl, selectors: decision.selectors });
        return {
          type: 'no_content',
          url: decision.targetUrl,
          reason: 'No content extracted with provided selectors',
        };
      }

      logInfo('OBSERVE', 'DOM extraction successful', { url: decision.targetUrl, elementCount: Object.keys(elements).length, selectors: decision.selectors });
      return {
        type: 'webpage',
        url: decision.targetUrl,
        data: elements,
        selectors: decision.selectors,
      };
    }

    default:
      return null;
  }
}

// ============================================
// FetchConfig Generation
// ============================================

/**
 * Generate FetchConfig from discoveries
 */
function generateFinalConfig(memory: ExplorationMemory): ExplorationResult {
  const { task, discoveries } = memory;

  logInfo('CONFIG', 'Generating final FetchConfig', { companyId: task.companyId, discoveryCount: discoveries.length });

  if (discoveries.length === 0) {
    logError('CONFIG', 'Failed: No discoveries');
    return {
      success: false,
      reason: 'No discoveries to generate config from',
    };
  }

  const url = pickBestUrl(discoveries);
  if (!url) {
    logError('CONFIG', 'Failed: No valid URL in discoveries');
    return {
      success: false,
      reason: 'No valid URL found in discoveries',
    };
  }

  logInfo('CONFIG', `Selected URL: ${url}`);

  const parseWith = inferParseMethod(discoveries);
  const selectors = buildSelectors(discoveries, task.contentTypes[0]);
  const pagination = inferPagination(discoveries);
  const authRequired = discoveries.some((d) => d.requiresAuth);
  const confidence = calculateConfidence(discoveries);

  logInfo('CONFIG', 'FetchConfig generated successfully', {
    contentType: task.contentTypes[0],
    parseWith,
    authRequired,
    confidence,
    pagination,
  });

  return {
    success: true,
    config: {
      companyId: task.companyId,
      contentType: task.contentTypes[0],
      name: `${task.company.name} - ${task.contentTypes.join('+')}`,
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

export function pickBestUrl(discoveries: Discovery[]): string | null {
  // Prefer API endpoints over webpages
  const apiDiscovery = discoveries.find((d) => d.type === 'api_endpoint');
  if (apiDiscovery?.url) {
    return apiDiscovery.url;
  }

  // Fall back to webpages
  const webpageDiscovery = discoveries.find((d) => d.type === 'webpage');
  if (webpageDiscovery?.url) {
    return webpageDiscovery.url;
  }

  return null;
}

export function inferParseMethod(discoveries: Discovery[]): 'json' | 'cheerio' {
  // If we found an API endpoint, parse as JSON
  const hasApi = discoveries.some((d) => d.type === 'api_endpoint');
  if (hasApi) {
    return 'json';
  }

  // Default to cheerio for HTML
  return 'cheerio';
}

function buildSelectors(
  discoveries: Discovery[],
  _contentType: string
): Record<string, string> {
  // Extract selectors from DOM extractions
  const extractedSelectors: Record<string, string> = {};

  for (const discovery of discoveries) {
    if (discovery.selectors) {
      Object.assign(extractedSelectors, discovery.selectors);
    }
  }

  // Default selectors if none extracted
  if (Object.keys(extractedSelectors).length === 0) {
    return {
      title: 'h1, .title, [class*="title"]',
      content: 'main, .content, [class*="content"]',
      link: 'a[href]',
    };
  }

  return extractedSelectors;
}

function inferPagination(
  _discoveries: Discovery[]
): { type: 'offset' | 'cursor' | 'page'; param: string } | undefined {
  // Simple heuristic for pagination
  // In a real implementation, analyze URL patterns or API responses
  return {
    type: 'page',
    param: 'page',
  };
}

export function calculateConfidence(discoveries: Discovery[]): number {
  if (discoveries.length === 0) return 0;

  let confidence = 50; // Base confidence

  // Bonus for API endpoint (structured data)
  if (discoveries.some((d) => d.type === 'api_endpoint')) {
    confidence += 30;
  }

  // Bonus for successful DOM extraction
  if (discoveries.some((d) => d.type === 'webpage' && d.selectors)) {
    confidence += 20;
  }

  // Penalty for auth requirement
  if (discoveries.some((d) => d.type === 'requires_auth')) {
    confidence -= 20;
  }

  // Penalty for no content
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
    // Remove trailing slash if present (handles both /path/ and /)
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

export function inferSelectors(contentType: string): Record<string, string> {
  switch (contentType) {
    case 'jobs':
    case 'careers':
      return {
        title: 'h1, .job-title, [class*="title"]',
        location: '.location, [class*="location"]',
        description: '.description, [class*="description"]',
        link: 'a[href*="/jobs/"], a[href*="/position/"]',
      };
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
// Main Explorer Function
// ============================================

/**
 * Main exploration function - runs ACT loop
 *
 * @param task - The exploration task with company info and content types to fetch
 * @param extension - The extension interface for browser communication
 * @returns ExplorationResult with FetchConfig if successful
 */
export async function explore(
  task: ExplorationTask,
  extension: ExtensionInterface
): Promise<ExplorationResult> {
  logInfo('EXPLORE', 'Starting exploration', { companyId: task.companyId, company: task.company.name, contentTypes: task.contentTypes });

  // 1. Initialize working memory
  const memory = initializeMemory(task);

  // 2. Retrieve context (empty in Iteration 1, memory comes Iteration 3)
  const priorKnowledge = await retrieveContext(task);

  // 3. ACT Loop (max 5 iterations)
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    memory.iteration = i;
    logInfo('LOOP', `=== Iteration ${i + 1}/${MAX_ITERATIONS} ===`, { pagesVisited: memory.pagesVisited, discoveriesCount: memory.discoveries.length });

    // THINK: Decide next action
    const decision = await decideNextAction({
      task,
      iteration: i,
      pagesVisited: memory.pagesVisited,
      discoveries: memory.discoveries,
      priorKnowledge,
    });

    // ACT: Execute via extension
    logInfo('ACT', 'Executing action via extension', { action: decision.action });
    const result = await executeAction(decision, extension);

    // OBSERVE: Analyze result
    const discovery = analyzeResult(result, decision);
    if (discovery) {
      memory.discoveries.push(discovery);
      logInfo('MEMORY', 'Discovery added', { type: discovery.type, url: discovery.url, reason: discovery.reason });
      if (decision.targetUrl && !memory.pagesVisited.includes(decision.targetUrl)) {
        memory.pagesVisited.push(decision.targetUrl);
        logInfo('MEMORY', 'Page added to visited', { url: decision.targetUrl });
      }
    } else {
      logInfo('OBSERVE', 'No discovery extracted from result');
    }

    // Learn: Store in memory (Iteration 3)
    await updateMemory(memory);

    // Check stopping conditions
    if (decision.action === 'GENERATE_CONFIG') {
      logInfo('LOOP', 'Stopping condition: GENERATE_CONFIG', { totalIterations: i + 1, totalDiscoveries: memory.discoveries.length });
      return generateFinalConfig(memory);
    }
    if (decision.action === 'FAIL') {
      logWarn('LOOP', 'Stopping condition: FAIL', { reason: decision.reason, totalIterations: i + 1 });
      return { success: false, reason: decision.reason };
    }
  }

  // Max iterations reached - try to generate config with what we have
  logWarn('LOOP', 'Max iterations reached', { totalDiscoveries: memory.discoveries.length });
  return generateFinalConfig(memory);
}

// ============================================
// Extension Wrapper (for HTTP polling communication)
// ============================================

/**
 * HTTP-based Extension interface for testing
 *
 * Protocol (matches Chrome Extension HTTP polling):
 * 1. Extension polls for commands: GET /commands?extensionId=xxx
 * 2. Extension posts results: POST /results { extensionId, results }
 *
 * For testing, we send commands directly and poll for results.
 */

// Shared extension ID for agent testing (matches test server's shared bucket)
const AGENT_EXTENSION_ID = 'shared';

export class HttpExtension implements ExtensionInterface {
  private serverUrl: string;
  private pendingRequests = new Map<string, {
    resolve: (result: ExtensionResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  async connect(): Promise<void> {
    // HTTP doesn't require connection - just verify server is reachable
    logInfo('HTTP_EXT', `Connecting to ${this.serverUrl}`);
    try {
      const response = await fetch(`${this.serverUrl}/commands?extensionId=${AGENT_EXTENSION_ID}`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      logInfo('HTTP_EXT', 'Connected successfully');
    } catch (error) {
      logError('HTTP_EXT', `Connection failed: ${error}`);
      throw new Error(`Failed to connect to ${this.serverUrl}: ${error}`);
    }
  }

  disconnect(): void {
    logInfo('HTTP_EXT', 'Disconnecting');
    // Clean up pending requests
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
    });
    this.pendingRequests.clear();
  }

  async sendCommand(command: ExtensionCommand): Promise<ExtensionResult> {
    logInfo('HTTP_EXT', `Sending command: ${command.type}`, { requestId: command.requestId });
    // Send command via POST
    const response = await fetch(`${this.serverUrl}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extensionId: AGENT_EXTENSION_ID,
        command,
      }),
    });

    if (!response.ok) {
      logWarn('HTTP_EXT', `POST failed: ${response.status}`);
      return { requestId: command.requestId, error: `POST failed: ${response.status}` };
    }

    logInfo('HTTP_EXT', `Waiting for result: ${command.requestId}`);
    // Wait for result via polling
    return this.waitForResult(command.requestId);
  }

  private async waitForResult(requestId: string): Promise<ExtensionResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        logError('HTTP_EXT', `Request timeout: ${requestId}`);
        reject(new Error('Request timeout'));
      }, NETWORK_TIMEOUT);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Wait for command to be consumed and executed before polling for results
      // This accounts for the extension poll interval (typically 1-2 seconds)
      setTimeout(() => {
        this.pollForResult(requestId, startTime);
      }, COMMAND_LATENCY_DELAY);
    });
  }

  private async pollForResult(requestId: string, startTime: number): Promise<void> {
    // Poll for result every 500ms
    const poll = async () => {
      if (!this.pendingRequests.has(requestId)) {
        return; // Already resolved/rejected
      }

      if (Date.now() - startTime > NETWORK_TIMEOUT) {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(requestId);
          pending.reject(new Error('Poll timeout'));
        }
        return;
      }

      try {
        const response = await fetch(`${this.serverUrl}/results?extensionId=${AGENT_EXTENSION_ID}`);
        if (response.ok) {
          const data = await response.json();
          const result = data.results?.find((r: ExtensionResult) => r.requestId === requestId);
          if (result) {
            const pending = this.pendingRequests.get(requestId);
            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingRequests.delete(requestId);
              logInfo('HTTP_EXT', `Result received: ${requestId}`, { hasError: !!result.error });
              pending.resolve(result);
              return;
            }
          }
        }
      } catch {
        // Continue polling on error
      }

      // Schedule next poll
      if (this.pendingRequests.has(requestId)) {
        setTimeout(poll, 500);
      }
    };

    poll();
  }

  async navigate(url: string): Promise<{ success: boolean; url: string; title: string; error?: string }> {
    const result = await this.sendCommand({
      type: 'NAVIGATE',
      requestId: crypto.randomUUID(),
      params: { url },
    });

    if (result.error) {
      return { success: false, url, title: '', error: result.error };
    }

    return result.data as { success: boolean; url: string; title: string; error?: string };
  }

  async getSnapshot(): Promise<PageSnapshot> {
    const result = await this.sendCommand({
      type: 'GET_SNAPSHOT',
      requestId: crypto.randomUUID(),
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data as PageSnapshot;
  }

  async extractElements(
    selectors: Record<string, string>
  ): Promise<Record<string, Array<{ tag: string; text: string; href?: string; src?: string }>>> {
    const result = await this.sendCommand({
      type: 'EXTRACT_DOM',
      requestId: crypto.randomUUID(),
      params: { selectors },
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data as Record<string, Array<{
      tag: string;
      text: string;
      href?: string;
      src?: string;
    }>>;
  }
}

// Keep WebSocketExtension as alias for backwards compatibility (deprecated)
export const WebSocketExtension = HttpExtension;