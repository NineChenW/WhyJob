// Service Worker - Main entry point for the Explorer Agent Chrome Extension
// Handles HTTP polling for commands and result posting

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
  MAX_RETRIES,
  RETRY_DELAY_MS,
} from './types';

// ============================================
// State
// ============================================

let config: PollingConfig = { ...DEFAULT_CONFIG };
let extensionId: string = 'explorer-extension-' + Math.random().toString(36).slice(2, 8);
let pollInterval: ReturnType<typeof setInterval> | null = null;
let isPolling = false;
let lastPollTime = 0;

// ============================================
// HTTP API Functions
// ============================================

/**
 * Poll the server for pending commands
 */
async function pollCommands(): Promise<Command[]> {
  try {
    const url = `${config.serverUrl}/commands?extensionId=${extensionId}&t=${lastPollTime}`;
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

    // Update server URL if changed
    if (data.serverUrl && data.serverUrl !== config.serverUrl) {
      config.serverUrl = data.serverUrl;
      console.log('[Explorer Extension] Server URL updated:', config.serverUrl);
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
        results,
      } as ResultPayload),
    }, config.connectionTimeoutMs);

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
// Polling Loop
// ============================================

/**
 * Start polling for commands
 */
function startPolling(): void {
  if (isPolling) return;

  isPolling = true;
  console.log('[Explorer Extension] Starting poll loop');

  pollLoop();

  pollInterval = setInterval(pollLoop, config.pollIntervalMs);
}

/**
 * Single poll iteration
 */
async function pollLoop(): Promise<void> {
  if (!isPolling) return;

  try {
    const commands = await pollCommands();

    if (commands.length > 0) {
      console.log(`[Explorer Extension] Received ${commands.length} command(s)`);

      const results = await executeCommands(commands);
      await postResults(results);
    }
  } catch (error) {
    console.error('[Explorer Extension] Poll loop error:', error);
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
// Command Execution
// ============================================

/**
 * Execute NAVIGATE command
 */
async function executeNavigate(params: NavigateParams, requestId: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      chrome.webNavigation.onCompleted.removeListener(onCompleted);
      chrome.webNavigation.onErrorOccurred.removeListener(onError);
      resolve({
        requestId,
        success: false,
        error: 'Navigation timeout (10s)',
      });
    }, NAVIGATION_TIMEOUT_MS);

    const onCompleted = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
      if (details.url === params.url || details.url.startsWith(params.url)) {
        clearTimeout(timeoutId);
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        chrome.webNavigation.onErrorOccurred.removeListener(onError);
        chrome.tabs.get(details.tabId, (tab) => {
          resolve({
            requestId,
            success: true,
            data: {
              success: true,
              url: tab?.url || params.url,
              title: tab?.title || '',
            } as NavigateResult,
          });
        });
      }
    };

    const onError = (details: chrome.webNavigation.WebNavigationErrorCallbackDetails) => {
      if (details.url === params.url || details.url.startsWith(params.url)) {
        clearTimeout(timeoutId);
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        chrome.webNavigation.onErrorOccurred.removeListener(onError);
        resolve({
          requestId,
          success: false,
          data: {
            success: false,
            url: params.url,
            title: '',
            error: details.error,
          } as NavigateResult,
        });
      }
    };

    chrome.webNavigation.onCompleted.addListener(onCompleted);
    chrome.webNavigation.onErrorOccurred.addListener(onError);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.update(tabs[0].id, { url: params.url });
      } else {
        chrome.tabs.create({ url: params.url });
      }
    });
  });
}

/**
 * Execute GET_SNAPSHOT command
 */
async function executeGetSnapshot(requestId: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;

      if (!tabId) {
        resolve({
          requestId,
          success: false,
          error: 'No active tab',
        });
        return;
      }

      chrome.tabs.sendMessage(tabId, { type: 'GET_SNAPSHOT' }, (response) => {
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
          data: response as SnapshotResult,
        });
      });
    });
  });
}

/**
 * Execute EXTRACT_DOM command
 */
async function executeExtractDom(params: ExtractDomParams, requestId: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;

      if (!tabId) {
        resolve({
          requestId,
          success: false,
          error: 'No active tab',
        });
        return;
      }

      chrome.tabs.sendMessage(tabId, {
        type: 'EXTRACT_DOM',
        params,
      }, (response) => {
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
// Message Listeners (from popup or other extension pages)
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
    });
    return true;
  }

  if (message.type === 'RECONNECT') {
    lastPollTime = 0;
    sendResponse({ success: true });
    return true;
  }

  return false;
});

console.log('[Explorer Extension] Service worker initialized');