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
let pollInterval: ReturnType<typeof setInterval> | null = null;

// Network monitoring state
let networkMonitorStore: NetworkCallStore = {};
let activeMonitoringId: string | null = null;
let capturedCalls: CapturedNetworkCall[] = [];
let lastGetNetworkLogTime = 0;
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
 * Poll the server for pending commands
 */
async function pollCommands(): Promise<Command[]> {
  if (!currentTaskId) {
    return [];
  }

  try {
    const url = `${config.serverUrl}/commands?extensionId=${extensionId}&taskId=${currentTaskId}&t=${lastPollTime}`;
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }, config.connectionTimeoutMs);

    if (!response.ok) {
      console.error(`[Explorer Extension] Poll failed: ${response.status}`);
      return [];
    }

    lastPollTime = Date.now();
    const data: PollResponse = await response.json();

    if (data.serverUrl && data.serverUrl !== config.serverUrl) {
      config.serverUrl = data.serverUrl;
      console.log('[Explorer Extension] Server URL updated:', config.serverUrl);
    }

    // Check if task is done
    if (data.taskStatus === 'complete' || data.taskStatus === 'failed') {
      console.log(`[Explorer Extension] Task ${currentTaskId} is now ${data.taskStatus}`);
      currentTaskId = null;
      // Close the task window
      await closeTaskWindow();
    }

    return data.commands || [];
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
 * Start polling for commands
 */
async function startPolling(): Promise<void> {
  if (isPolling) return;

  isPolling = true;
  console.log('[Explorer Extension] Starting poll loop');

  await attemptPickup();

  pollInterval = setInterval(pollLoop, config.pollIntervalMs);
}

/**
 * Attempt to pick up a task and create a window for it
 */
async function attemptPickup(): Promise<boolean> {
  if (currentTaskId && pendingCommandId) {
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
 * Single poll iteration
 */
async function pollLoop(): Promise<void> {
  if (!isPolling) return;

  if (pendingCommandId) {
    return;
  }

  try {
    // 1. If no current task, try to pick one up
    if (!currentTaskId) {
      const pickupResult = await pickupTask();
      if (pickupResult?.pickedUp && pickupResult.task) {
        currentTaskId = pickupResult.task.id;
        console.log('[Explorer Extension] Picked up task:', currentTaskId);
        await createTaskWindow();
      } else if (pickupResult?.alreadyProcessing && pickupResult.task) {
        currentTaskId = pickupResult.task.id;
        console.log('[Explorer Extension] Task already being processed:', currentTaskId);
        await createTaskWindow();
      } else {
        currentTaskId = null;
        return;
      }
    }

    // 2. Poll for commands
    const commands = await pollCommands();

    if (commands.length === 0) {
      // No commands - task done or waiting for something
      pendingCommandId = null;
      // Don't nullify currentTaskId here - let pollCommands handle task completion
      // which will close the window
      return;
    }

    // 3. Execute command and mark as pending
    pendingCommandId = commands[0].requestId;
    console.log(`[Explorer Extension] Executing: ${commands[0].type} (${commands[0].requestId})`);

    const results = await executeCommands(commands);
    await postResults(results);

    pendingCommandId = null;
  } catch (error) {
    console.error('[Explorer Extension] Poll loop error:', error);
    pendingCommandId = null;
  }
}

/**
 * Execute commands and collect results
 */
async function executeCommands(commands: Command[]): Promise<CommandResult[]> {
  const results: CommandResult[] = [];

  for (const command of commands) {
    try {
      console.log(`[Explorer Extension] Executing: ${command.type} (${command.requestId})`);

      let result: CommandResult;

      switch (command.type) {
        case 'NAVIGATE':
          result = await executeNavigate(command.params as NavigateParams, command.requestId);
          break;

        case 'GET_SNAPSHOT':
          result = await executeGetSnapshot(command.requestId);
          break;

        case 'EXTRACT_DOM':
          result = await executeExtractDom(command.params as ExtractDomParams, command.requestId);
          break;

        case 'EXECUTE_JS':
          result = await executeJs(command.params as ExecuteJsParams, command.requestId);
          break;

        case 'START_NETWORK_MONITORING':
          result = await executeStartNetworkMonitoring(command.requestId);
          break;

        case 'GET_NETWORK_LOG':
          result = await executeGetNetworkLog(command.params as GetNetworkLogParams | undefined, command.requestId);
          break;

        case 'STOP_NETWORK_MONITORING':
          result = await executeStopNetworkMonitoring(command.params as StopNetworkMonitoringParams, command.requestId);
          break;

        default:
          result = {
            requestId: command.requestId,
            success: false,
            error: `Unknown command type: ${(command as any).type}`,
          };
      }

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
 * Execute NAVIGATE command
 */
async function executeNavigate(params: NavigateParams, requestId: string): Promise<CommandResult> {
  const targetUrl = params.url;
  const normalizedTarget = normalizeUrl(targetUrl);

  return new Promise((resolve) => {
    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      chrome.webNavigation.onCompleted.removeListener(onCompleted);
      chrome.webNavigation.onErrorOccurred.removeListener(onError);
      resolve({
        requestId,
        success: false,
        error: 'Navigation timeout (10s)',
      });
    }, NAVIGATION_TIMEOUT_MS);

    const onCompleted = (details: { url: string; tabId: number }) => {
      chrome.tabs.get(details.tabId, (tabInfo) => {
        if (chrome.runtime.lastError || !tabInfo?.windowId || tabInfo.windowId !== currentTaskWindowId) {
          return;
        }

        const normalizedActual = normalizeUrl(details.url);
        if (normalizedActual === normalizedTarget || details.url.startsWith(targetUrl)) {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          chrome.webNavigation.onCompleted.removeListener(onCompleted);
          chrome.webNavigation.onErrorOccurred.removeListener(onError);
          resolve({
            requestId,
            success: true,
            data: {
              success: true,
              url: tabInfo.url || targetUrl,
              title: tabInfo.title || '',
            } as NavigateResult,
          });
        }
      });
    };

    const onError = (details: { url: string; tabId: number; error: string }) => {
      chrome.tabs.get(details.tabId, (tabInfo) => {
        if (chrome.runtime.lastError || !tabInfo?.windowId || tabInfo.windowId !== currentTaskWindowId) {
          return;
        }

        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        chrome.webNavigation.onErrorOccurred.removeListener(onError);
        resolve({
          requestId,
          success: false,
          data: {
            success: false,
            url: targetUrl,
            title: '',
            error: details.error,
          } as NavigateResult,
        });
      });
    };

    chrome.webNavigation.onCompleted.addListener(onCompleted);
    chrome.webNavigation.onErrorOccurred.addListener(onError);

    // Get the task window's tab
    getTaskWindowTab().then((tab) => {
      if (!tab?.id) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        chrome.webNavigation.onErrorOccurred.removeListener(onError);
        resolve({
          requestId,
          success: false,
          error: 'No tab in task window',
        });
        return;
      }

      // Check if already on the target URL
      if (tab.url && normalizeUrl(tab.url) === normalizedTarget) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        chrome.webNavigation.onErrorOccurred.removeListener(onError);
        resolve({
          requestId,
          success: true,
          data: {
            success: true,
            url: tab.url,
            title: tab.title || '',
          } as NavigateResult,
        });
        return;
      }

      // Navigate to target URL
      // Clear network calls on new navigation
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
 * Execute GET_SNAPSHOT command
 */
async function executeGetSnapshot(requestId: string): Promise<CommandResult> {
  const tab = await getTaskWindowTab();

  if (!tab?.id) {
    return {
      requestId,
      success: false,
      error: 'No active tab in task window',
    };
  }

  const tabId = tab.id;
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'GET_SNAPSHOT' }, (response: SnapshotResult | undefined) => {
      if (chrome.runtime.lastError) {
        console.error('[Explorer Extension] Snapshot failed:', chrome.runtime.lastError);
        resolve({
          requestId,
          success: false,
          error: chrome.runtime.lastError.message,
        });
        return;
      }

      resolve({
        requestId,
        success: true,
        data: response,
      });
    });
  });
}

/**
 * Execute EXTRACT_DOM command
 */
async function executeExtractDom(params: ExtractDomParams, requestId: string): Promise<CommandResult> {
  const tab = await getTaskWindowTab();

  if (!tab?.id) {
    return {
      requestId,
      success: false,
      error: 'No active tab in task window',
    };
  }

  const tabId = tab.id;
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, {
      type: 'EXTRACT_DOM',
      params,
    }, (response: ExtractDomResult | undefined) => {
      if (chrome.runtime.lastError) {
        console.error('[Explorer Extension] Extract DOM failed:', chrome.runtime.lastError);
        resolve({
          requestId,
          success: false,
          error: chrome.runtime.lastError.message,
        });
        return;
      }

      resolve({
        requestId,
        success: true,
        data: response as ExtractDomResult,
      });
    });
  });
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
 */
function handleNetworkCompleted(details: chrome.webRequest.WebRequestDetails) {
  if (!activeMonitoringId) return;

  // Only capture XHR and fetch requests
  if (details.type !== 'xmlhttprequest' && details.type !== 'fetch') return;

  // Build captured network call object
  const call: CapturedNetworkCall = {
    id: generateNetworkCallId(),
    url: details.url,
    method: details.method,
    status: details.statusCode || 0,
    responseType: details.type === 'xmlhttprequest' ? 'xhr' : 'fetch',
    timing: 0, // Timing not available from onCompleted
    requestHeaders: {}, // Headers not available from onCompleted in MV3
    responseHeaders: {}, // Would need onHeadersReceived for this
    timestamp: new Date(),
  };

  // Store in the active monitoring session
  if (networkMonitorStore[activeMonitoringId]) {
    networkMonitorStore[activeMonitoringId].calls.push(call);

    // Also add to capturedCalls for GET_SNAPSHOT
    capturedCalls.push(call);

    // FIFO limit
    if (capturedCalls.length > MAX_NETWORK_CALLS_STORED) {
      capturedCalls = capturedCalls.slice(-MAX_NETWORK_CALLS_STORED);
    }
    if (networkMonitorStore[activeMonitoringId].calls.length > MAX_NETWORK_CALLS_STORED) {
      networkMonitorStore[activeMonitoringId].calls = networkMonitorStore[activeMonitoringId].calls.slice(-MAX_NETWORK_CALLS_STORED);
    }
  }
}

/**
 * Execute EXECUTE_JS command
 */
async function executeJs(params: ExecuteJsParams, requestId: string): Promise<CommandResult> {
  const tab = await getTaskWindowTab();

  if (!tab?.id) {
    return {
      requestId,
      success: false,
      error: 'No active tab in task window',
    };
  }

  const tabId = tab.id;

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({
        requestId,
        success: false,
        data: {
          success: false,
          error: 'Script timeout after 5000ms',
          duration: JS_EXECUTION_TIMEOUT_MS,
        } as ExecuteJsResult,
      });
    }, JS_EXECUTION_TIMEOUT_MS);

    // Use chrome.scripting.executeScript in MV3
    chrome.scripting.executeScript({
      target: { tabId },
      func: (script, args) => {
        // Capture console.log output
        const logs: string[] = [];
        const originalLog = console.log;
        console.log = (...args: unknown[]) => {
          logs.push(args.map(a => String(a)).join(' '));
        };

        try {
          // Execute the script with args in scope
          const result = new Function('args', `with(args) { return eval(${JSON.stringify(script)}); }`)(args || {});
          console.log = originalLog;
          return {
            success: true,
            output: logs.join('\n').slice(0, 1000) || (result !== undefined ? String(result).slice(0, 1000) : ''),
            duration: 0,
          };
        } catch (error) {
          console.log = originalLog;
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            output: logs.join('\n').slice(0, 1000),
            duration: 0,
          };
        }
      },
      args: [params.script, params.args || {}],
    }).then((results) => {
      clearTimeout(timeoutId);
      const result = results[0]?.result as ExecuteJsResult | undefined;
      resolve({
        requestId,
        success: result?.success ?? false,
        data: result,
      });
    }).catch((error) => {
      clearTimeout(timeoutId);
      resolve({
        requestId,
        success: false,
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: JS_EXECUTION_TIMEOUT_MS,
        } as ExecuteJsResult,
      });
    });
  });
}

/**
 * Execute START_NETWORK_MONITORING command
 */
async function executeStartNetworkMonitoring(requestId: string): Promise<CommandResult> {
  // Check if monitoring already active
  if (activeMonitoringId !== null) {
    return {
      requestId,
      success: false,
      data: {
        success: false,
        monitoringId: activeMonitoringId,
        message: 'Monitoring already active',
      } as StartNetworkMonitoringResult,
    };
  }

  // Create new monitoring session
  const monitoringId = 'monitor_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  networkMonitorStore[monitoringId] = {
    calls: [],
    startTime: Date.now(),
  };
  activeMonitoringId = monitoringId;
  capturedCalls = [];
  lastGetNetworkLogTime = 0;

  // Set up webRequest listener if not already active
  if (!webRequestListenerActive) {
    chrome.webRequest.onCompleted.addListener(handleNetworkCompleted, {
      urls: ['<all_urls>'],
      types: ['xmlhttprequest'], // Only xmlhttprequest is valid; it captures both XHR and fetch
    });
    webRequestListenerActive = true;
    console.log('[Explorer Extension] WebRequest listener activated');
  }

  console.log('[Explorer Extension] Network monitoring started:', monitoringId);

  return {
    requestId,
    success: true,
    data: {
      success: true,
      monitoringId,
      message: 'Network monitoring started',
    } as StartNetworkMonitoringResult,
  };
}

/**
 * Execute GET_NETWORK_LOG command
 */
async function executeGetNetworkLog(params: GetNetworkLogParams | undefined, requestId: string): Promise<CommandResult> {
  const monitoringId = params?.monitoringId || activeMonitoringId;

  // Get the monitoring session
  const session = monitoringId ? networkMonitorStore[monitoringId] : null;
  if (!session && monitoringId) {
    return {
      requestId,
      success: false,
      data: {
        calls: [],
        count: 0,
        hasMore: false,
      } as GetNetworkLogResult,
    };
  }

  // Get calls to return
  const allCalls = session ? session.calls : capturedCalls;

  // Filter calls if specified
  let filteredCalls = allCalls;

  if (params?.filter) {
    const { urlPattern, methods, statusRange } = params.filter;

    filteredCalls = filteredCalls.filter(call => {
      // URL pattern filter
      if (urlPattern) {
        try {
          const regex = new RegExp(urlPattern);
          if (!regex.test(call.url)) return false;
        } catch {
          // Invalid regex, skip filter
        }
      }

      // Method filter
      if (methods && methods.length > 0) {
        if (!methods.includes(call.method)) return false;
      }

      // Status range filter
      if (statusRange) {
        const firstDigit = Math.floor(call.status / 100);
        const rangeMap: Record<string, number> = { '2xx': 2, '3xx': 3, '4xx': 4, '5xx': 5 };
        if (firstDigit !== rangeMap[statusRange]) return false;
      }

      return true;
    });
  }

  const hasMore = filteredCalls.length > MAX_NETWORK_CALLS_STORED;

  return {
    requestId,
    success: true,
    data: {
      calls: filteredCalls,
      count: filteredCalls.length,
      hasMore,
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