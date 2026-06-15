// types.ts
var DEFAULT_CONFIG = {
  serverUrl: "http://localhost:3000/api/agent",
  pollIntervalMs: 2e3,
  connectionTimeoutMs: 1e4
};
var NAVIGATION_TIMEOUT_MS = 1e4;

// service-worker.ts
var config = { ...DEFAULT_CONFIG };
var extensionId = "explorer-extension-" + Math.random().toString(36).slice(2, 8);
var isPolling = false;
var lastPollTime = 0;
var currentTaskId = null;
var currentTaskWindowId = null;
var pendingCommandId = null;
var pollInterval = null;
async function pickupTask() {
  try {
    const baseUrl = config.serverUrl.replace(/\/api\/agent$/, "");
    const url = `${baseUrl}/api/explorer/tasks/pickup`;
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }, config.connectionTimeoutMs);
    if (!response.ok) {
      console.error(`[Explorer Extension] Pickup failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Explorer Extension] Pickup error:", error);
    return null;
  }
}
async function pollCommands() {
  if (!currentTaskId) {
    return [];
  }
  try {
    const url = `${config.serverUrl}/commands?extensionId=${extensionId}&taskId=${currentTaskId}&t=${lastPollTime}`;
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
    if (data.taskStatus === "complete" || data.taskStatus === "failed") {
      console.log(`[Explorer Extension] Task ${currentTaskId} is now ${data.taskStatus}`);
      currentTaskId = null;
      await closeTaskWindow();
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
        taskId: currentTaskId,
        results
      })
    }, config.connectionTimeoutMs);
    console.log(`[Explorer Extension] Posted ${results.length} results, status: ${response.status}`);
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
async function createTaskWindow() {
  await closeTaskWindow();
  return new Promise((resolve) => {
    chrome.windows.create(
      {
        url: "about:blank",
        focused: true
      },
      (window) => {
        if (window && window.id) {
          currentTaskWindowId = window.id;
          console.log("[Explorer Extension] Created task window:", window.id);
          resolve(window.id);
        } else {
          console.error("[Explorer Extension] Failed to create window");
          resolve(null);
        }
      }
    );
  });
}
async function closeTaskWindow() {
  if (currentTaskWindowId !== null) {
    try {
      await chrome.windows.remove(currentTaskWindowId);
      console.log("[Explorer Extension] Closed task window:", currentTaskWindowId);
    } catch (error) {
      console.log("[Explorer Extension] Window already closed or error:", error);
    }
    currentTaskWindowId = null;
  }
}
async function startPolling() {
  if (isPolling) return;
  isPolling = true;
  console.log("[Explorer Extension] Starting poll loop");
  await attemptPickup();
  pollInterval = setInterval(pollLoop, config.pollIntervalMs);
}
async function attemptPickup() {
  if (currentTaskId && pendingCommandId) {
    return true;
  }
  await closeTaskWindow();
  const pickupResult = await pickupTask();
  if (pickupResult) {
    if (pickupResult.pickedUp || pickupResult.alreadyProcessing) {
      currentTaskId = pickupResult.task?.id ?? null;
      console.log("[Explorer Extension] Picked up task:", currentTaskId);
      await createTaskWindow();
      return true;
    } else {
      console.log("[Explorer Extension] No pending tasks");
      currentTaskId = null;
    }
  }
  return false;
}
async function pollLoop() {
  if (!isPolling) return;
  if (pendingCommandId) {
    return;
  }
  try {
    if (!currentTaskId) {
      const pickupResult = await pickupTask();
      if (pickupResult?.pickedUp && pickupResult.task) {
        currentTaskId = pickupResult.task.id;
        console.log("[Explorer Extension] Picked up task:", currentTaskId);
        await createTaskWindow();
      } else if (pickupResult?.alreadyProcessing && pickupResult.task) {
        currentTaskId = pickupResult.task.id;
        console.log("[Explorer Extension] Task already being processed:", currentTaskId);
        await createTaskWindow();
      } else {
        currentTaskId = null;
        return;
      }
    }
    const commands = await pollCommands();
    if (commands.length === 0) {
      pendingCommandId = null;
      return;
    }
    pendingCommandId = commands[0].requestId;
    console.log(`[Explorer Extension] Executing: ${commands[0].type} (${commands[0].requestId})`);
    const results = await executeCommands(commands);
    await postResults(results);
    pendingCommandId = null;
  } catch (error) {
    console.error("[Explorer Extension] Poll loop error:", error);
    pendingCommandId = null;
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
async function getTaskWindowTab() {
  if (!currentTaskWindowId) {
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
    console.error("[Explorer Extension] Failed to get task window tab:", error);
  }
  return null;
}
async function executeNavigate(params, requestId) {
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
        error: "Navigation timeout (10s)"
      });
    }, NAVIGATION_TIMEOUT_MS);
    const onCompleted = (details) => {
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
              title: tabInfo.title || ""
            }
          });
        }
      });
    };
    const onError = (details) => {
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
            title: "",
            error: details.error
          }
        });
      });
    };
    chrome.webNavigation.onCompleted.addListener(onCompleted);
    chrome.webNavigation.onErrorOccurred.addListener(onError);
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
          error: "No tab in task window"
        });
        return;
      }
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
            title: tab.title || ""
          }
        });
        return;
      }
      chrome.tabs.update(tab.id, { url: targetUrl });
    });
  });
}
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.host}${path}`;
  } catch {
    return url;
  }
}
async function executeGetSnapshot(requestId) {
  const tab = await getTaskWindowTab();
  if (!tab?.id) {
    return {
      requestId,
      success: false,
      error: "No active tab in task window"
    };
  }
  const tabId = tab.id;
  return new Promise((resolve) => {
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
}
async function executeExtractDom(params, requestId) {
  const tab = await getTaskWindowTab();
  if (!tab?.id) {
    return {
      requestId,
      success: false,
      error: "No active tab in task window"
    };
  }
  const tabId = tab.id;
  return new Promise((resolve) => {
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
      lastPoll: lastPollTime ? new Date(lastPollTime).toISOString() : null,
      currentTaskId,
      currentTaskWindowId
    });
    return true;
  }
  if (message.type === "RECONNECT") {
    lastPollTime = 0;
    sendResponse({ success: true });
    return true;
  }
  if (message.type === "CLOSE_TASK_WINDOW") {
    closeTaskWindow();
    sendResponse({ success: true });
    return true;
  }
  return false;
});
console.log("[Explorer Extension] Service worker initialized");
//# sourceMappingURL=service-worker.js.map
