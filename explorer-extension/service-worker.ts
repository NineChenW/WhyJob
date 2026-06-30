// Service Worker - Main entry point for the Explorer Agent Chrome Extension
// Handles HTTP polling for commands and result posting
// Each task gets its own browser window for isolation

import type {
  Command,
  CommandResult,
  PollResponse,
  ResultPayload,
  PollingConfig,
  NavigateParams,
  ExtractDomParams,
  NavigateResult,
  SnapshotResult,
  ExtractDomResult,
  ExecuteJsParams,
  ExecuteJsResult,
  StartNetworkMonitoringResult,
  GetNetworkLogParams,
  GetNetworkLogResult,
  StopNetworkMonitoringParams,
  StopNetworkMonitoringResult,
  CapturedNetworkCall,
  NetworkCallStore,
} from './types';

import {
  DEFAULT_CONFIG,
  NAVIGATION_TIMEOUT_MS,
  JS_EXECUTION_TIMEOUT_MS,
  MAX_NETWORK_CALLS_STORED,
} from './types';

// ============================================
// State
// ============================================

let config: PollingConfig = { ...DEFAULT_CONFIG };
let extensionId: string = 'explorer-extension-' + Math.random().toString(36).slice(2, 8);
let isPolling = false;
let lastPollTime = 0;
let currentTaskId: string | null = null;
let currentTaskWindowId: number | null = null; // Window dedicated to current task
let pendingCommandId: string | null = null; // Track if we're waiting for command to execute
let isProcessingCycle = false; // Prevent overlapping poll cycles
const MAX_RECENTLY_EXECUTED = 10;
let recentlyExecutedIds: string[] = []; // Track last N executed requestIds for deduplication

// Network monitoring state
let networkMonitorStore: NetworkCallStore = {};
let acensureTaskWindowForExecutiontiveMonitoringId: string | null = null;
let capturedCalls: CapturedNetworkCall[] = [];
let lastGetNetworkLogTime = 0;

// Lazy-initialized command handler map (function refs are hoisted)
let commandHandlerMap: Record<string, (cmd: Command) => Promise<CommandResult>> | null = null;

function getCommandHandlerMap(): Record<string, (cmd: Command) => Promise<CommandResult>> {
  if (!commandHandlerMap) {
    commandHandlerMap = {
      NAVIGATE: (cmd) => executeNavigate(cmd.params as NavigateParams, cmd.requestId),
      GET_SNAPSHOT: (cmd) => executeGetSnapshot(cmd.requestId),
      EXTRACT_DOM: (cmd) => executeExtractDom(cmd.params as ExtractDomParams, cmd.requestId),
      EXECUTE_JS: (cmd) => executeJs(cmd.params as ExecuteJsParams, cmd.requestId),
      START_NETWORK_MONITORING: (cmd) => executeStartNetworkMonitoring(cmd.requestId),
      GET_NETWORK_LOG: (cmd) => executeGetNetworkLog(cmd.params as GetNetworkLogParams | undefined, cmd.requestId),
      STOP_NETWORK_MONITORING: (cmd) => executeStopNetworkMonitoring(cmd.params as StopNetworkMonitoringParams, cmd.requestId),
    };
  }
  return commandHandlerMap;
}
let webRequestListenerActive = false;

// ============================================
// HTTP API Functions
// ============================================

/**
 * Pickup a task from the server
 */
async function pickupTask(): Promise<{
  pickedUp: boolean;
  alreadyProcessing: boolean;
  task: { id: string; companyId: string; contentTypes: string[] } | null;
} | null> {
  try {
    const baseUrl = config.serverUrl.replace(/\/api\/agent$/, '');
    const url = `${baseUrl}/api/explorer/tasks/pickup`;
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, config.connectionTimeoutMs);

    if (!response.ok) {
      console.error(`[Explorer Extension] Pickup failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Explorer Extension] Pickup error:', error);
    return null;
  }
}

/**
 * Handle poll response - update server URL if changed, check task status
 */
async function handlePollResponse(data: PollResponse): Promise<Command[]> {
  if (data.serverUrl && data.serverUrl !== config.serverUrl) {
    config.serverUrl = data.serverUrl;
    console.log('[Explorer Extension] Server URL updated:', config.serverUrl);
  }
  if (data.taskStatus === 'complete' || data.taskStatus === 'failed') {
    console.log(`[Explorer Extension] Task ${currentTaskId} is now ${data.taskStatus}`);
    currentTaskId = null;
    await closeTaskWindow();
  }
  return data.commands || [];
}

/**
 * Poll the server for pending commands
 */
async function pollCommands(): Promise<Command[]> {
  if (!currentTaskId) return [];

  try {
    const url = `${config.serverUrl}/commands?extensionId=${extensionId}&taskId=${currentTaskId}&t=${lastPollTime}`;
    const response = await fetchWithTimeout(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } }, config.connectionTimeoutMs);
    if (!response.ok) { console.error(`[Explorer Extension] Poll failed: ${response.status}`); return []; }
    lastPollTime = Date.now();
    return handlePollResponse(await response.json());
  } catch (error) {
    console.error('[Explorer Extension] Poll error:', error);
    return [];
  }
}

/**
 * Post command results to the server
 */
async function postResults(results: CommandResult[]): Promise<boolean> {
  if (results.length === 0) return true;

  try {
    const response = await fetchWithTimeout(`${config.serverUrl}/results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extensionId,
        taskId: currentTaskId,
        results,
      } as ResultPayload),
    }, config.connectionTimeoutMs);

    console.log(`[Explorer Extension] Posted ${results.length} results, status: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error('[Explorer Extension] Post results failed:', error);
    return false;
  }
}

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================
// Task Window Management
// ============================================

/**
 * Create a new browser window for the current task
 */
async function createTaskWindow(): Promise<number | null> {
  // Close any existing task window first
  await closeTaskWindow();

  return new Promise((resolve) => {
    chrome.windows.create(
      {
        url: 'about:blank',
        focused: true,
      },
      (window) => {
        if (window && window.id) {
          currentTaskWindowId = window.id;
          console.log('[Explorer Extension] Created task window:', window.id);
          resolve(window.id);
        } else {
          console.error('[Explorer Extension] Failed to create window');
          resolve(null);
        }
      }
    );
  });
}

/**
 * Close the task window and clean up
 */
async function closeTaskWindow(): Promise<void> {
  if (currentTaskWindowId !== null) {
    try {
      await chrome.windows.remove(currentTaskWindowId);
      console.log('[Explorer Extension] Closed task window:', currentTaskWindowId);
    } catch (error) {
      // Window may already be closed
      console.log('[Explorer Extension] Window already closed or error:', error);
    }
    currentTaskWindowId = null;
  }
}

// ============================================
// Polling Loop
// ============================================

/**
 * Start polling for commands using recursive async loop (not setInterval)
 * This ensures each poll cycle completes before the next one starts
 */
async function startPolling(): Promise<void> {
  if (isPolling) return;

  isPolling = true;
  console.log('[Explorer Extension] Starting poll loop');

  // Initial pickup attempt
  await attemptPickup();

  // Use recursive async loop instead of setInterval to prevent overlapping cycles
  pollLoopRecursive();
}

let pollLoopRunning = false;

/**
 * Recursive poll loop - waits for each cycle to complete before starting next
 */
async function pollLoopRecursive(): Promise<void> {
  if (!isPolling || pollLoopRunning) return;

  pollLoopRunning = true;

  try {
    await pollLoopIteration();
  } catch (error) {
    console.error('[Explorer Extension] Poll loop error:', error);
  } finally {
    pollLoopRunning = false;
  }

  // Schedule next cycle only if still polling
  if (isPolling) {
    setTimeout(pollLoopRecursive, config.pollIntervalMs);
  }
}

/**
 * Attempt to pick up a task and create a window for it
 */
async function attemptPickup(): Promise<boolean> {
  // If we're already processing a command, don't try to pick up a new task
  if (currentTaskId && (pendingCommandId || isProcessingCycle)) {
    return true;
  }

  // Close any existing window before picking up new task
  await closeTaskWindow();

  const pickupResult = await pickupTask();
  if (pickupResult) {
    if (pickupResult.pickedUp || pickupResult.alreadyProcessing) {
      currentTaskId = pickupResult.task?.id ?? null;
      console.log('[Explorer Extension] Picked up task:', currentTaskId);

      // Create a new window for this task
      await createTaskWindow();
      return true;
    } else {
      console.log('[Explorer Extension] No pending tasks');
      currentTaskId = null;
    }
  }
  return false;
}

/**
 * Single poll iteration (called by pollLoopRecursive)
 * Steps:
 * 1. Guard: check polling state
 * 2. Pickup task if needed
 * 3. Poll for commands
 * 4. Filter duplicates and execute
 */
async function pollLoopIteration(): Promise<void> {
  // Step 1: Guard clauses
  if (!isPolling) return;
  if (isProcessingCycle) {
    console.log('[Explorer Extension] Skipping poll - already processing previous cycle');
    return;
  }
  if (pendingCommandId) {
    console.log('[Explorer Extension] Resetting stuck pendingCommandId:', pendingCommandId);
    pendingCommandId = null;
  }

  try {
    isProcessingCycle = true;

    // Step 2: Pickup task if needed
    if (!currentTaskId) {
      const hasTask = await pickupTaskIfNeeded();
      if (!hasTask) return;
    }

    // Step 3: Poll for commands
    const allCommands = await pollCommands();
    const commands = filterDuplicateCommands(allCommands);
    if (commands.length === 0) return;

    // Step 4: Ensure window and execute
    await ensureTaskWindowForExecution();
    const cmdToExecute = commands[0];
    pendingCommandId = cmdToExecute.requestId;
    console.log(`[Explorer Extension] Executing: ${cmdToExecute.type} (${cmdToExecute.requestId})`);

    const results = await executeCommands([cmdToExecute]);
    await postResults(results);
    trackExecutedCommand(cmdToExecute.requestId);

  } catch (error) {
    console.error('[Explorer Extension] Poll iteration error:', error);
  } finally {
    pendingCommandId = null;
    isProcessingCycle = false;
  }
}

// ============================================
// Poll Loop Helpers (for pollLoopIteration)
// ============================================

/**
 * Phase 1: Pick up a task if none active
 */
async function pickupTaskIfNeeded(): Promise<boolean> {
  if (currentTaskId) return true;

  const result = await pickupTask();
  if (result?.pickedUp && result.task) {
    currentTaskId = result.task.id;
    console.log('[Explorer Extension] Picked up task:', currentTaskId);
    return true;
  }
  if (result?.alreadyProcessing && result.task) {
    currentTaskId = result.task.id;
    console.log('[Explorer Extension] Task already being processed:', currentTaskId);
    return true;
  }
  currentTaskId = null;
  return false;
}

/**
 * Phase 2a: Filter out recently-executed commands
 */
function filterDuplicateCommands(allCommands: Command[]): Command[] {
  return allCommands.filter(cmd => {
    if (recentlyExecutedIds.includes(cmd.requestId)) {
      console.log(`[Explorer Extension] Ignoring duplicate command: ${cmd.type} (${cmd.requestId})`);
      return false;
    }
    return true;
  });
}

/**
 * Phase 3: Ensure task window exists before execution
 */
async function ensureTaskWindowForExecution(): Promise<boolean> {
  if (currentTaskWindowId) return true;
  console.log('[Explorer Extension] Creating task window for command execution');
  await createTaskWindow();
  return currentTaskWindowId !== null;
}

/**
 * Phase 4: Track executed command ID for deduplication
 */
function trackExecutedCommand(requestId: string): void {
  recentlyExecutedIds.push(requestId);
  if (recentlyExecutedIds.length > MAX_RECENTLY_EXECUTED) {
    recentlyExecutedIds.shift();
  }
}

/**
 * Execute commands and collect results
 */
async function executeCommands(commands: Command[]): Promise<CommandResult[]> {
  const results: CommandResult[] = [];
  const handlerMap = getCommandHandlerMap();

  for (const command of commands) {
    try {
      console.log(`[Explorer Extension] Executing: ${command.type} (${command.requestId})`);

      // Step: Dispatch via handler map
      const handler = handlerMap[command.type];
      if (!handler) {
        results.push({
          requestId: command.requestId,
          success: false,
          error: `Unknown command type: ${command.type}`,
        });
        continue;
      }

      const result = await handler(command);
      results.push(result);
    } catch (error) {
      results.push({
        requestId: command.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

// ============================================
// Command Execution (operate on task window)
// ============================================

/**
 * Get the active tab in the task window
 */
async function getTaskWindowTab(): Promise<chrome.tabs.Tab | null> {
  if (!currentTaskWindowId) {
    // Fallback: try to get any tab in the window
    const windows = await chrome.windows.getAll({ populate: true });
    for (const win of windows) {
      if (win.id === currentTaskWindowId && win.tabs && win.tabs[0]) {
        return win.tabs[0];
      }
    }
    return null;
  }

  try {
    const window = await chrome.windows.get(currentTaskWindowId, { populate: true });
    if (window.tabs && window.tabs[0]) {
      return window.tabs[0];
    }
  } catch (error) {
    console.error('[Explorer Extension] Failed to get task window tab:', error);
  }

  return null;
}

/**
 * Remove navigation listeners (cleanup helper)
 */
function removeNavigationListeners(
  onCompleted: (details: chrome.webNavigation.NavigationEvent) => void,
  onError: (details: chrome.webNavigation.NavigationErrorEvent) => void
): void {
  chrome.webNavigation.onCompleted.removeListener(onCompleted);
  chrome.webNavigation.onErrorOccurred.removeListener(onError);
}

/**
 * Execute NAVIGATE command
 * Steps:
 * 1. Setup timeout
 * 2. Define navigation listeners
 * 3. Get tab and navigate (or resolve if already there)
 */
async function executeNavigate(params: NavigateParams, requestId: string): Promise<CommandResult> {
  const targetUrl = params.url;
  const normalizedTarget = normalizeUrl(targetUrl);

  return new Promise((resolve) => {
    const resolved = { value: false };

    // Step 1: Setup timeout
    const timeoutId = setTimeout(() => {
      if (resolved.value) return;
      resolved.value = true;
      removeNavigationListeners(onCompleted, onError);
      resolve({ requestId, success: false, error: 'Navigation timeout (10s)' });
    }, NAVIGATION_TIMEOUT_MS);

    // Step 2: Define navigation listeners
    const onCompleted = (details: { url: string; tabId: number }) => {
      chrome.tabs.get(details.tabId, (tabInfo) => {
        if (chrome.runtime.lastError || !tabInfo?.windowId || tabInfo.windowId !== currentTaskWindowId) return;
        const normalizedActual = normalizeUrl(details.url);
        if (normalizedActual === normalizedTarget || details.url.startsWith(targetUrl)) {
          if (resolved.value) return;
          resolved.value = true;
          clearTimeout(timeoutId);
          removeNavigationListeners(onCompleted, onError);
          resolve({ requestId, success: true, data: { success: true, url: tabInfo.url || targetUrl, title: tabInfo.title || '' } as NavigateResult });
        }
      });
    };

    const onError = (details: { url: string; tabId: number; error: string }) => {
      chrome.tabs.get(details.tabId, (tabInfo) => {
        if (chrome.runtime.lastError || !tabInfo?.windowId || tabInfo.windowId !== currentTaskWindowId) return;
        if (resolved.value) return;
        resolved.value = true;
        clearTimeout(timeoutId);
        removeNavigationListeners(onCompleted, onError);
        resolve({ requestId, success: false, data: { success: false, url: targetUrl, title: '', error: details.error } as NavigateResult });
      });
    };

    // Step 3: Setup listeners and get tab
    chrome.webNavigation.onCompleted.addListener(onCompleted);
    chrome.webNavigation.onErrorOccurred.addListener(onError);

    getTaskWindowTab().then((tab) => {
      // 3a. No tab
      if (!tab?.id) {
        if (resolved.value) return;
        resolved.value = true;
        clearTimeout(timeoutId);
        removeNavigationListeners(onCompleted, onError);
        resolve({ requestId, success: false, error: 'No tab in task window' });
        return;
      }

      // 3b. Already on target
      if (tab.url && normalizeUrl(tab.url) === normalizedTarget) {
        if (resolved.value) return;
        resolved.value = true;
        clearTimeout(timeoutId);
        removeNavigationListeners(onCompleted, onError);
        resolve({ requestId, success: true, data: { success: true, url: tab.url, title: tab.title || '' } as NavigateResult });
        return;
      }

      // 3c. Navigate
      capturedCalls = [];
      chrome.tabs.update(tab.id, { url: targetUrl });
    });
  });
}

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.host}${path}`;
  } catch {
    return url;
  }
}

/**
 * Call content script with a message and return result
 */
async function callContentScript<T>(
  tabId: number,
  requestId: string,
  messageType: string,
  params?: Record<string, unknown>
): Promise<CommandResult> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: messageType, ...(params ? { params } : {}) }, (response: T | undefined) => {
      if (chrome.runtime.lastError) {
        console.error(`[Explorer Extension] ${messageType} failed:`, chrome.runtime.lastError);
        resolve({ requestId, success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve({ requestId, success: true, data: response as unknown as CommandResult['data'] });
    });
  });
}

/**
 * Execute GET_SNAPSHOT command
 */
async function executeGetSnapshot(requestId: string): Promise<CommandResult> {
  const tab = await getTaskWindowTab();
  if (!tab?.id) return { requestId, success: false, error: 'No active tab in task window' };
  return callContentScript<SnapshotResult>(tab.id, requestId, 'GET_SNAPSHOT');
}

/**
 * Execute EXTRACT_DOM command
 */
async function executeExtractDom(params: ExtractDomParams, requestId: string): Promise<CommandResult> {
  const tab = await getTaskWindowTab();
  if (!tab?.id) return { requestId, success: false, error: 'No active tab in task window' };
  return callContentScript<ExtractDomResult>(tab.id, requestId, 'EXTRACT_DOM', params as unknown as Record<string, unknown>);
}

// ============================================
// Network Monitoring Functions
// ============================================

/**
 * Generate unique ID for network calls
 */
function generateNetworkCallId(): string {
  return 'nc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Handle completed network request - captures response data
 * Steps:
 * 1. Guard: check if monitoring active
 * 2. Build captured call object
 * 3. Store in sessions with FIFO limit
 */
function handleNetworkCompleted(details: chrome.webRequest.WebRequestDetails) {
  // Step 1: Guard
  if (!activeMonitoringId) return;
  if (details.type !== 'xmlhttprequest' && details.type !== 'fetch') return;

  // Step 2: Build captured call
  const call: CapturedNetworkCall = {
    id: generateNetworkCallId(),
    url: details.url,
    method: details.method,
    status: details.statusCode || 0,
    responseType: details.type === 'xmlhttprequest' ? 'xhr' : 'fetch',
    timing: 0,
    requestHeaders: {},
    responseHeaders: {},
    timestamp: new Date(),
  };

  // Step 3: Store with FIFO limit
  const session = networkMonitorStore[activeMonitoringId];
  if (session) {
    session.calls.push(call);
    capturedCalls.push(call);
    enforceCallLimit(session.calls);
    enforceCallLimit(capturedCalls);
  }
}

/**
 * Enforce FIFO limit on call array
 */
function enforceCallLimit(calls: CapturedNetworkCall[]): void {
  if (calls.length > MAX_NETWORK_CALLS_STORED) {
    calls.splice(0, calls.length - MAX_NETWORK_CALLS_STORED);
  }
}

/**
 * Build ExecuteJsResult for timeout case
 */
function makeJsTimeoutResult(requestId: string): CommandResult {
  return { requestId, success: false, data: { success: false, error: 'Script timeout after 5000ms', duration: JS_EXECUTION_TIMEOUT_MS } as ExecuteJsResult };
}

/**
 * Build ExecuteJsResult for error case
 */
function makeJsErrorResult(requestId: string, error: string, output?: string): CommandResult {
  return { requestId, success: false, data: { success: false, error, output, duration: JS_EXECUTION_TIMEOUT_MS } as ExecuteJsResult };
}

/**
 * Execute EXECUTE_JS command
 * Steps:
 * 1. Get task window tab
 * 2. Setup timeout guard
 * 3. Execute script via chrome.scripting.executeScript
 */
async function executeJs(params: ExecuteJsParams, requestId: string): Promise<CommandResult> {
  // Step 1: Get task window tab
  const tab = await getTaskWindowTab();
  if (!tab?.id) return { requestId, success: false, error: 'No active tab in task window' };

  const tabId = tab.id;

  return new Promise((resolve) => {
    // Step 2: Setup timeout
    const timeoutId = setTimeout(() => resolve(makeJsTimeoutResult(requestId)), JS_EXECUTION_TIMEOUT_MS);

    // Step 3: Execute script (inline func required by MV3 chrome.scripting API)
    chrome.scripting.executeScript({
      target: { tabId },
      func: (script, args) => {
        const logs: string[] = [];
        const originalLog = console.log;
        console.log = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); };
        try {
          const result = new Function('args', `with(args) { return eval(${JSON.stringify(script)}); }`)(args || {});
          console.log = originalLog;
          return { success: true, output: logs.join('\n').slice(0, 1000) || (result !== undefined ? String(result).slice(0, 1000) : ''), duration: 0 };
        } catch (error) {
          console.log = originalLog;
          return { success: false, error: error instanceof Error ? error.message : String(error), output: logs.join('\n').slice(0, 1000), duration: 0 };
        }
      },
      args: [params.script, params.args || {}],
    }).then((results) => {
      clearTimeout(timeoutId);
      const result = results[0]?.result as ExecuteJsResult | undefined;
      resolve({ requestId, success: result?.success ?? false, data: result });
    }).catch((error) => {
      clearTimeout(timeoutId);
      resolve(makeJsErrorResult(requestId, error instanceof Error ? error.message : String(error)));
    });
  });
}

/**
 * Generate unique monitoring session ID
 */
function generateMonitoringId(): string {
  return 'monitor_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

/**
 * Activate webRequest listener for network monitoring
 */
function activateNetworkListener(): void {
  if (webRequestListenerActive) return;
  chrome.webRequest.onCompleted.addListener(handleNetworkCompleted, {
    urls: ['<all_urls>'],
    types: ['xmlhttprequest'],
  });
  webRequestListenerActive = true;
  console.log('[Explorer Extension] WebRequest listener activated');
}

/**
 * Execute START_NETWORK_MONITORING command
 * Steps:
 * 1. Check if already active
 * 2. Create monitoring session
 * 3. Activate listener and return result
 */
async function executeStartNetworkMonitoring(requestId: string): Promise<CommandResult> {
  // Step 1: Guard - check if already active
  if (activeMonitoringId !== null) {
    return { requestId, success: false, data: { success: false, monitoringId: activeMonitoringId, message: 'Monitoring already active' } as StartNetworkMonitoringResult };
  }

  // Step 2: Create monitoring session
  const monitoringId = generateMonitoringId();
  networkMonitorStore[monitoringId] = { calls: [], startTime: Date.now() };
  activeMonitoringId = monitoringId;
  capturedCalls = [];
  lastGetNetworkLogTime = 0;

  // Step 3: Activate listener and return
  activateNetworkListener();
  console.log('[Explorer Extension] Network monitoring started:', monitoringId);
  return { requestId, success: true, data: { success: true, monitoringId, message: 'Network monitoring started' } as StartNetworkMonitoringResult };
}

// ============================================
// Network Log Filter Helpers (for executeGetNetworkLog)
// ============================================

/**
 * Filter calls by URL pattern
 */
function filterByUrlPattern(calls: CapturedNetworkCall[], urlPattern: string): CapturedNetworkCall[] {
  try {
    const regex = new RegExp(urlPattern);
    return calls.filter(call => regex.test(call.url));
  } catch {
    return calls; // Invalid regex, skip filter
  }
}

/**
 * Filter calls by HTTP methods
 */
function filterByMethods(calls: CapturedNetworkCall[], methods: string[]): CapturedNetworkCall[] {
  return calls.filter(call => methods.includes(call.method));
}

/**
 * Filter calls by status range (2xx, 3xx, 4xx, 5xx)
 */
function filterByStatusRange(calls: CapturedNetworkCall[], statusRange: string): CapturedNetworkCall[] {
  const rangeMap: Record<string, number> = { '2xx': 2, '3xx': 3, '4xx': 4, '5xx': 5 };
  const firstDigit = rangeMap[statusRange];
  return calls.filter(call => Math.floor(call.status / 100) === firstDigit);
}

/**
 * Execute GET_NETWORK_LOG command
 */
async function executeGetNetworkLog(params: GetNetworkLogParams | undefined, requestId: string): Promise<CommandResult> {
  const monitoringId = params?.monitoringId || activeMonitoringId;

  // Step 1: Get monitoring session
  const session = monitoringId ? networkMonitorStore[monitoringId] : null;
  if (!session && monitoringId) {
    return { requestId, success: false, data: { calls: [], count: 0, hasMore: false } as GetNetworkLogResult };
  }

  // Step 2: Get calls and apply filters
  const allCalls = session ? session.calls : capturedCalls;
  let filteredCalls = allCalls;

  if (params?.filter) {
    const { urlPattern, methods, statusRange } = params.filter;
    if (urlPattern) filteredCalls = filterByUrlPattern(filteredCalls, urlPattern);
    if (methods?.length) filteredCalls = filterByMethods(filteredCalls, methods);
    if (statusRange) filteredCalls = filterByStatusRange(filteredCalls, statusRange);
  }

  // Step 3: Return result
  return {
    requestId,
    success: true,
    data: {
      calls: filteredCalls,
      count: filteredCalls.length,
      hasMore: filteredCalls.length > MAX_NETWORK_CALLS_STORED,
    } as GetNetworkLogResult,
  };
}

/**
 * Execute STOP_NETWORK_MONITORING command
 */
async function executeStopNetworkMonitoring(params: StopNetworkMonitoringParams, requestId: string): Promise<CommandResult> {
  const { monitoringId } = params;

  // Validate monitoringId
  if (!networkMonitorStore[monitoringId]) {
    return {
      requestId,
      success: false,
      error: 'Invalid monitoringId',
    };
  }

  const session = networkMonitorStore[monitoringId];
  const duration = Date.now() - session.startTime;
  const totalCallsCaptured = session.calls.length;

  // Clean up monitoring session
  delete networkMonitorStore[monitoringId];

  // If this was the active monitoring, clear active state and listener
  if (activeMonitoringId === monitoringId) {
    activeMonitoringId = null;
    capturedCalls = [];

    // Remove webRequest listener if no more monitoring sessions
    if (Object.keys(networkMonitorStore).length === 0 && webRequestListenerActive) {
      chrome.webRequest.onCompleted.removeListener(handleNetworkCompleted);
      webRequestListenerActive = false;
      console.log('[Explorer Extension] WebRequest listener deactivated');
    }
  }

  console.log('[Explorer Extension] Network monitoring stopped:', monitoringId, 'Duration:', duration, 'ms, Calls:', totalCallsCaptured);

  return {
    requestId,
    success: true,
    data: {
      success: true,
      totalCallsCaptured,
      duration,
    } as StopNetworkMonitoringResult,
  };
}

// ============================================
// Extension Installation & Lifecycle
// ============================================

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Explorer Extension] Installed:', details.reason);
  if (details.reason === 'install') {
    console.log('[Explorer Extension] First install - ready to connect');
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Explorer Extension] Service worker starting');
  startPolling();
});

// Get extension ID and start polling
console.log('[Explorer Extension] Extension ID:', extensionId);
startPolling();

// ============================================
// Message Listeners
// ============================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SET_SERVER_URL') {
    config.serverUrl = message.url;
    console.log('[Explorer Extension] Server URL updated:', config.serverUrl);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'GET_STATUS') {
    sendResponse({
      connected: isPolling,
      serverUrl: config.serverUrl,
      extensionId,
      lastPoll: lastPollTime ? new Date(lastPollTime).toISOString() : null,
      currentTaskId,
      currentTaskWindowId,
    });
    return true;
  }

  if (message.type === 'RECONNECT') {
    lastPollTime = 0;
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CLOSE_TASK_WINDOW') {
    closeTaskWindow();
    sendResponse({ success: true });
    return true;
  }

  // Debug commands for popup testing (not via HTTP polling)
  // Return Promise so Chrome handles async response properly
  if (message.type === 'DEBUG_EXECUTE_JS') {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) {
          resolve({ success: false, error: 'No active tab' });
          return;
        }

        // Inject into MAIN world (the actual page), not content script context
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN', // Execute in the actual page context
          func: (script) => {
            try {
              // Create and execute script element in main world
              const el = document.createElement('script');
              el.textContent = script;
              (document.head || document.documentElement).appendChild(el);
              el.remove();
              return { success: true, output: 'alert shown & page turned red' };
            } catch (e: unknown) {
              return { success: false, error: String(e) };
            }
          },
          args: [message.script],
        }).then((results) => {
          resolve({ success: true, ...results[0]?.result });
        }).catch((error) => {
          resolve({ success: false, error: error.message });
        });
      });
    });
  }

  if (message.type === 'DEBUG_START_MONITOR') {
    // Force reset any stale monitoring state and start fresh
    if (webRequestListenerActive) {
      try {
        chrome.webRequest.onCompleted.removeListener(handleNetworkCompleted);
      } catch (e) {
        // Listener might not be registered
      }
      webRequestListenerActive = false;
    }
    networkMonitorStore = {};
    activeMonitoringId = null;
    capturedCalls = [];

    return executeStartNetworkMonitoring('debug')
      .then(r => r.data as any)
      .catch(err => ({ success: false, error: String(err) }));
  }

  if (message.type === 'DEBUG_GET_NETWORK_LOG') {
    return executeGetNetworkLog({ monitoringId: message.monitoringId }, 'debug')
      .then(r => ({ success: r.success, ...r.data }))
      .catch(err => ({ success: false, error: String(err) }));
  }

  if (message.type === 'DEBUG_STOP_MONITOR') {
    return executeStopNetworkMonitoring({ monitoringId: message.monitoringId }, 'debug')
      .then(r => {
        return { success: r.success, ...r.data };
      })
      .catch(err => ({ success: false, error: String(err) }));
  }

  return false;
});

console.log('[Explorer Extension] Service worker initialized');