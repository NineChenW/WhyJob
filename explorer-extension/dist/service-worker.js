// types.ts
var DEFAULT_CONFIG = {
  serverUrl: "http://localhost:3000/api/agent",
  pollIntervalMs: 2e3,
  connectionTimeoutMs: 1e4
};
var NAVIGATION_TIMEOUT_MS = 2e4;
var JS_EXECUTION_TIMEOUT_MS = 5e3;
var MAX_NETWORK_CALLS_STORED = 500;

// service-worker.ts
var config = { ...DEFAULT_CONFIG };
var extensionId = "explorer-extension-" + Math.random().toString(36).slice(2, 8);
var isPolling = false;
var lastPollTime = 0;
var currentTaskId = null;
var currentTaskWindowId = null;
var pendingCommandId = null;
var isProcessingCycle = false;
var MAX_RECENTLY_EXECUTED = 10;
var recentlyExecutedIds = [];
var networkMonitorStore = {};
var activeMonitoringId = null;
var capturedCalls = [];
var lastGetNetworkLogTime = 0;
var webRequestListenerActive = false;
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
  pollLoopRecursive();
}
var pollLoopRunning = false;
async function pollLoopRecursive() {
  if (!isPolling || pollLoopRunning) return;
  pollLoopRunning = true;
  try {
    await pollLoopIteration();
  } catch (error) {
    console.error("[Explorer Extension] Poll loop error:", error);
  } finally {
    pollLoopRunning = false;
  }
  if (isPolling) {
    setTimeout(pollLoopRecursive, config.pollIntervalMs);
  }
}
async function attemptPickup() {
  if (currentTaskId && (pendingCommandId || isProcessingCycle)) {
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
async function pollLoopIteration() {
  if (!isPolling) return;
  if (isProcessingCycle) {
    console.log("[Explorer Extension] Skipping poll - already processing previous cycle");
    return;
  }
  if (pendingCommandId) {
    console.log("[Explorer Extension] Resetting stuck pendingCommandId:", pendingCommandId);
    pendingCommandId = null;
  }
  try {
    isProcessingCycle = true;
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
    const allCommands = await pollCommands();
    const commands = allCommands.filter((cmd) => {
      if (recentlyExecutedIds.includes(cmd.requestId)) {
        console.log(`[Explorer Extension] Ignoring duplicate command: ${cmd.type} (${cmd.requestId})`);
        return false;
      }
      return true;
    });
    if (commands.length === 0) {
      return;
    }
    const cmdToExecute = commands[0];
    pendingCommandId = cmdToExecute.requestId;
    console.log(`[Explorer Extension] Executing: ${cmdToExecute.type} (${cmdToExecute.requestId})`);
    const results = await executeCommands([cmdToExecute]);
    await postResults(results);
    recentlyExecutedIds.push(cmdToExecute.requestId);
    if (recentlyExecutedIds.length > MAX_RECENTLY_EXECUTED) {
      recentlyExecutedIds.shift();
    }
  } catch (error) {
    console.error("[Explorer Extension] Poll iteration error:", error);
  } finally {
    pendingCommandId = null;
    isProcessingCycle = false;
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
        case "EXECUTE_JS":
          result = await executeJs(command.params, command.requestId);
          break;
        case "START_NETWORK_MONITORING":
          result = await executeStartNetworkMonitoring(command.requestId);
          break;
        case "GET_NETWORK_LOG":
          result = await executeGetNetworkLog(command.params, command.requestId);
          break;
        case "STOP_NETWORK_MONITORING":
          result = await executeStopNetworkMonitoring(command.params, command.requestId);
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
      capturedCalls = [];
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
function generateNetworkCallId() {
  return "nc_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}
function handleNetworkCompleted(details) {
  if (!activeMonitoringId) return;
  if (details.type !== "xmlhttprequest" && details.type !== "fetch") return;
  const call = {
    id: generateNetworkCallId(),
    url: details.url,
    method: details.method,
    status: details.statusCode || 0,
    responseType: details.type === "xmlhttprequest" ? "xhr" : "fetch",
    timing: 0,
    // Timing not available from onCompleted
    requestHeaders: {},
    // Headers not available from onCompleted in MV3
    responseHeaders: {},
    // Would need onHeadersReceived for this
    timestamp: /* @__PURE__ */ new Date()
  };
  if (networkMonitorStore[activeMonitoringId]) {
    networkMonitorStore[activeMonitoringId].calls.push(call);
    capturedCalls.push(call);
    if (capturedCalls.length > MAX_NETWORK_CALLS_STORED) {
      capturedCalls = capturedCalls.slice(-MAX_NETWORK_CALLS_STORED);
    }
    if (networkMonitorStore[activeMonitoringId].calls.length > MAX_NETWORK_CALLS_STORED) {
      networkMonitorStore[activeMonitoringId].calls = networkMonitorStore[activeMonitoringId].calls.slice(-MAX_NETWORK_CALLS_STORED);
    }
  }
}
async function executeJs(params, requestId) {
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
    const timeoutId = setTimeout(() => {
      resolve({
        requestId,
        success: false,
        data: {
          success: false,
          error: "Script timeout after 5000ms",
          duration: JS_EXECUTION_TIMEOUT_MS
        }
      });
    }, JS_EXECUTION_TIMEOUT_MS);
    chrome.scripting.executeScript({
      target: { tabId },
      func: (script, args) => {
        const logs = [];
        const originalLog = console.log;
        console.log = (...args2) => {
          logs.push(args2.map((a) => String(a)).join(" "));
        };
        try {
          const result = new Function("args", `with(args) { return eval(${JSON.stringify(script)}); }`)(args || {});
          console.log = originalLog;
          return {
            success: true,
            output: logs.join("\n").slice(0, 1e3) || (result !== void 0 ? String(result).slice(0, 1e3) : ""),
            duration: 0
          };
        } catch (error) {
          console.log = originalLog;
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            output: logs.join("\n").slice(0, 1e3),
            duration: 0
          };
        }
      },
      args: [params.script, params.args || {}]
    }).then((results) => {
      clearTimeout(timeoutId);
      const result = results[0]?.result;
      resolve({
        requestId,
        success: result?.success ?? false,
        data: result
      });
    }).catch((error) => {
      clearTimeout(timeoutId);
      resolve({
        requestId,
        success: false,
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: JS_EXECUTION_TIMEOUT_MS
        }
      });
    });
  });
}
async function executeStartNetworkMonitoring(requestId) {
  if (activeMonitoringId !== null) {
    return {
      requestId,
      success: false,
      data: {
        success: false,
        monitoringId: activeMonitoringId,
        message: "Monitoring already active"
      }
    };
  }
  const monitoringId = "monitor_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  networkMonitorStore[monitoringId] = {
    calls: [],
    startTime: Date.now()
  };
  activeMonitoringId = monitoringId;
  capturedCalls = [];
  lastGetNetworkLogTime = 0;
  if (!webRequestListenerActive) {
    chrome.webRequest.onCompleted.addListener(handleNetworkCompleted, {
      urls: ["<all_urls>"],
      types: ["xmlhttprequest"]
      // Only xmlhttprequest is valid; it captures both XHR and fetch
    });
    webRequestListenerActive = true;
    console.log("[Explorer Extension] WebRequest listener activated");
  }
  console.log("[Explorer Extension] Network monitoring started:", monitoringId);
  return {
    requestId,
    success: true,
    data: {
      success: true,
      monitoringId,
      message: "Network monitoring started"
    }
  };
}
async function executeGetNetworkLog(params, requestId) {
  const monitoringId = params?.monitoringId || activeMonitoringId;
  const session = monitoringId ? networkMonitorStore[monitoringId] : null;
  if (!session && monitoringId) {
    return {
      requestId,
      success: false,
      data: {
        calls: [],
        count: 0,
        hasMore: false
      }
    };
  }
  const allCalls = session ? session.calls : capturedCalls;
  let filteredCalls = allCalls;
  if (params?.filter) {
    const { urlPattern, methods, statusRange } = params.filter;
    filteredCalls = filteredCalls.filter((call) => {
      if (urlPattern) {
        try {
          const regex = new RegExp(urlPattern);
          if (!regex.test(call.url)) return false;
        } catch {
        }
      }
      if (methods && methods.length > 0) {
        if (!methods.includes(call.method)) return false;
      }
      if (statusRange) {
        const firstDigit = Math.floor(call.status / 100);
        const rangeMap = { "2xx": 2, "3xx": 3, "4xx": 4, "5xx": 5 };
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
      hasMore
    }
  };
}
async function executeStopNetworkMonitoring(params, requestId) {
  const { monitoringId } = params;
  if (!networkMonitorStore[monitoringId]) {
    return {
      requestId,
      success: false,
      error: "Invalid monitoringId"
    };
  }
  const session = networkMonitorStore[monitoringId];
  const duration = Date.now() - session.startTime;
  const totalCallsCaptured = session.calls.length;
  delete networkMonitorStore[monitoringId];
  if (activeMonitoringId === monitoringId) {
    activeMonitoringId = null;
    capturedCalls = [];
    if (Object.keys(networkMonitorStore).length === 0 && webRequestListenerActive) {
      chrome.webRequest.onCompleted.removeListener(handleNetworkCompleted);
      webRequestListenerActive = false;
      console.log("[Explorer Extension] WebRequest listener deactivated");
    }
  }
  console.log("[Explorer Extension] Network monitoring stopped:", monitoringId, "Duration:", duration, "ms, Calls:", totalCallsCaptured);
  return {
    requestId,
    success: true,
    data: {
      success: true,
      totalCallsCaptured,
      duration
    }
  };
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
  if (message.type === "DEBUG_EXECUTE_JS") {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) {
          resolve({ success: false, error: "No active tab" });
          return;
        }
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          // Execute in the actual page context
          func: (script) => {
            try {
              const el = document.createElement("script");
              el.textContent = script;
              (document.head || document.documentElement).appendChild(el);
              el.remove();
              return { success: true, output: "alert shown & page turned red" };
            } catch (e) {
              return { success: false, error: String(e) };
            }
          },
          args: [message.script]
        }).then((results) => {
          resolve({ success: true, ...results[0]?.result });
        }).catch((error) => {
          resolve({ success: false, error: error.message });
        });
      });
    });
  }
  if (message.type === "DEBUG_START_MONITOR") {
    if (webRequestListenerActive) {
      try {
        chrome.webRequest.onCompleted.removeListener(handleNetworkCompleted);
      } catch (e) {
      }
      webRequestListenerActive = false;
    }
    networkMonitorStore = {};
    activeMonitoringId = null;
    capturedCalls = [];
    return executeStartNetworkMonitoring("debug").then((r) => r.data).catch((err) => ({ success: false, error: String(err) }));
  }
  if (message.type === "DEBUG_GET_NETWORK_LOG") {
    return executeGetNetworkLog({ monitoringId: message.monitoringId }, "debug").then((r) => ({ success: r.success, ...r.data })).catch((err) => ({ success: false, error: String(err) }));
  }
  if (message.type === "DEBUG_STOP_MONITOR") {
    return executeStopNetworkMonitoring({ monitoringId: message.monitoringId }, "debug").then((r) => {
      return { success: r.success, ...r.data };
    }).catch((err) => ({ success: false, error: String(err) }));
  }
  return false;
});
console.log("[Explorer Extension] Service worker initialized");
//# sourceMappingURL=service-worker.js.map
