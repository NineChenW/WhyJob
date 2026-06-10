// types.ts
var DEFAULT_CONFIG = {
  serverUrl: "http://127.0.0.1:3001/api/agent",
  // Standalone test server
  pollIntervalMs: 2e3,
  connectionTimeoutMs: 1e4
};
var NAVIGATION_TIMEOUT_MS = 1e4;

// service-worker.ts
var config = { ...DEFAULT_CONFIG };
var extensionId = "explorer-extension-" + Math.random().toString(36).slice(2, 8);
var pollInterval = null;
var isPolling = false;
var lastPollTime = 0;
async function pollCommands() {
  try {
    const url = `${config.serverUrl}/commands?extensionId=${extensionId}&t=${lastPollTime}`;
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    }, config.connectionTimeoutMs);
    if (!response.ok) {
      console.error(`[Explorer Extension] Poll failed: ${response.status}`);
      return [];
    }
    lastPollTime = Date.now();
    const data = await response.json();
    if (data.serverUrl && data.serverUrl !== config.serverUrl) {
      config.serverUrl = data.serverUrl;
      console.log("[Explorer Extension] Server URL updated:", config.serverUrl);
    }
    return data.commands || [];
  } catch (error) {
    console.error("[Explorer Extension] Poll error:", error);
    return [];
  }
}
async function postResults(results) {
  if (results.length === 0) return true;
  try {
    const response = await fetchWithTimeout(`${config.serverUrl}/results`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        extensionId,
        results
      })
    }, config.connectionTimeoutMs);
    return response.ok;
  } catch (error) {
    console.error("[Explorer Extension] Post results failed:", error);
    return false;
  }
}
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
function startPolling() {
  if (isPolling) return;
  isPolling = true;
  console.log("[Explorer Extension] Starting poll loop");
  pollLoop();
  pollInterval = setInterval(pollLoop, config.pollIntervalMs);
}
async function pollLoop() {
  if (!isPolling) return;
  try {
    const commands = await pollCommands();
    if (commands.length > 0) {
      console.log(`[Explorer Extension] Received ${commands.length} command(s)`);
      const results = await executeCommands(commands);
      await postResults(results);
    }
  } catch (error) {
    console.error("[Explorer Extension] Poll loop error:", error);
  }
}
async function executeCommands(commands) {
  const results = [];
  for (const command of commands) {
    try {
      console.log(`[Explorer Extension] Executing: ${command.type} (${command.requestId})`);
      let result;
      switch (command.type) {
        case "NAVIGATE":
          result = await executeNavigate(command.params, command.requestId);
          break;
        case "GET_SNAPSHOT":
          result = await executeGetSnapshot(command.requestId);
          break;
        case "EXTRACT_DOM":
          result = await executeExtractDom(command.params, command.requestId);
          break;
        default:
          result = {
            requestId: command.requestId,
            success: false,
            error: `Unknown command type: ${command.type}`
          };
      }
      results.push(result);
    } catch (error) {
      results.push({
        requestId: command.requestId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
  return results;
}
async function executeNavigate(params, requestId) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      chrome.webNavigation.onCompleted.removeListener(onCompleted);
      chrome.webNavigation.onErrorOccurred.removeListener(onError);
      resolve({
        requestId,
        success: false,
        error: "Navigation timeout (10s)"
      });
    }, NAVIGATION_TIMEOUT_MS);
    const onCompleted = (details) => {
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
              title: tab?.title || ""
            }
          });
        });
      }
    };
    const onError = (details) => {
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
            title: "",
            error: details.error
          }
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
async function executeGetSnapshot(requestId) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        resolve({
          requestId,
          success: false,
          error: "No active tab"
        });
        return;
      }
      chrome.tabs.sendMessage(tabId, { type: "GET_SNAPSHOT" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Explorer Extension] Snapshot failed:", chrome.runtime.lastError);
          resolve({
            requestId,
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }
        resolve({
          requestId,
          success: true,
          data: response
        });
      });
    });
  });
}
async function executeExtractDom(params, requestId) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        resolve({
          requestId,
          success: false,
          error: "No active tab"
        });
        return;
      }
      chrome.tabs.sendMessage(tabId, {
        type: "EXTRACT_DOM",
        params
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Explorer Extension] Extract DOM failed:", chrome.runtime.lastError);
          resolve({
            requestId,
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }
        resolve({
          requestId,
          success: true,
          data: response
        });
      });
    });
  });
}
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[Explorer Extension] Installed:", details.reason);
  if (details.reason === "install") {
    console.log("[Explorer Extension] First install - ready to connect");
  }
});
chrome.runtime.onStartup.addListener(() => {
  console.log("[Explorer Extension] Service worker starting");
  startPolling();
});
console.log("[Explorer Extension] Extension ID:", extensionId);
startPolling();
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SET_SERVER_URL") {
    config.serverUrl = message.url;
    console.log("[Explorer Extension] Server URL updated:", config.serverUrl);
    sendResponse({ success: true });
    return true;
  }
  if (message.type === "GET_STATUS") {
    sendResponse({
      connected: isPolling,
      serverUrl: config.serverUrl,
      extensionId,
      lastPoll: lastPollTime ? new Date(lastPollTime).toISOString() : null
    });
    return true;
  }
  if (message.type === "RECONNECT") {
    lastPollTime = 0;
    sendResponse({ success: true });
    return true;
  }
  return false;
});
console.log("[Explorer Extension] Service worker initialized");
//# sourceMappingURL=service-worker.js.map
