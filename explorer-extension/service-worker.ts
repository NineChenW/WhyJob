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
} from './types';

import {
  DEFAULT_CONFIG,
  NAVIGATION_TIMEOUT_MS,
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

  return false;
});

console.log('[Explorer Extension] Service worker initialized');