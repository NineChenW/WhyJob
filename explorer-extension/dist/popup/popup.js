// popup/popup.ts
var statusIndicator = document.getElementById("statusIndicator");
var statusText = document.getElementById("statusText");
var serverUrlEl = document.getElementById("serverUrl");
var logEl = document.getElementById("log");
var btnSnapshot = document.getElementById("btnSnapshot");
var btnExtract = document.getElementById("btnExtract");
var btnReconnect = document.getElementById("btnReconnect");
var isConnected = false;
function addLog(message, type = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] ${message}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 50) {
    logEl.removeChild(logEl.firstChild);
  }
}
function updateStatus(connected, serverUrl) {
  isConnected = connected;
  if (connected) {
    statusIndicator.className = "status-indicator connected";
    statusText.textContent = "Connected";
    btnSnapshot.disabled = false;
    btnExtract.disabled = false;
  } else {
    statusIndicator.className = "status-indicator disconnected";
    statusText.textContent = "Disconnected";
    btnSnapshot.disabled = true;
    btnExtract.disabled = true;
  }
  if (serverUrl) {
    serverUrlEl.textContent = serverUrl;
  }
}
btnSnapshot.addEventListener("click", async () => {
  addLog("Getting snapshot...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      addLog("No active tab", "error");
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_SNAPSHOT" });
    if (response) {
      addLog(`Snapshot: ${response.title?.slice(0, 30) || "no title"}`, "success");
    }
  } catch (error) {
    addLog(`Snapshot failed: ${error.message}`, "error");
  }
});
btnExtract.addEventListener("click", async () => {
  addLog("Extracting DOM...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      addLog("No active tab", "error");
      return;
    }
    const testSelectors = {
      title: "h1",
      links: "a[href]",
      images: "img[src]"
    };
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_DOM",
      params: { selectors: testSelectors }
    });
    if (response?.elements) {
      const count = Object.values(response.elements).flat().length;
      addLog(`Extracted ${count} elements`, "success");
    }
  } catch (error) {
    addLog(`Extract failed: ${error.message}`, "error");
  }
});
btnReconnect.addEventListener("click", () => {
  addLog("Reconnecting...");
  chrome.runtime.sendMessage({ type: "RECONNECT" }, (response) => {
    if (response?.success) {
      addLog("Reconnection triggered", "success");
    }
  });
});
async function init() {
  try {
    const status = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (status) {
      updateStatus(status.connected, status.serverUrl);
      addLog(status.connected ? "Connected to server" : "Not connected");
    }
  } catch (error) {
    addLog("Failed to get status", "error");
  }
}
init();
var statusInterval = setInterval(init, 3e3);
window.addEventListener("unload", () => {
  clearInterval(statusInterval);
});
//# sourceMappingURL=popup.js.map
