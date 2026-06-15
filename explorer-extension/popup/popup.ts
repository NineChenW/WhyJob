// Popup UI Script

const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const serverUrlEl = document.getElementById('serverUrl');
const logEl = document.getElementById('log');
const btnSnapshot = document.getElementById('btnSnapshot');
const btnExtract = document.getElementById('btnExtract');
const btnReconnect = document.getElementById('btnReconnect');
const btnExecuteJs = document.getElementById('btnExecuteJs');
const btnStartMonitor = document.getElementById('btnStartMonitor');
const btnGetLog = document.getElementById('btnGetLog');
const btnStopMonitor = document.getElementById('btnStopMonitor');

let isConnected = false;
let monitoringId: string | null = null;
let monitoringActive = false;

// Initialize button states
btnExecuteJs.disabled = true;
btnGetLog.disabled = true;
btnStopMonitor.disabled = true;

// ============================================
// Logging
// ============================================

function addLog(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;

  // Keep last 50 entries
  while (logEl.children.length > 50) {
    logEl.removeChild(logEl.firstChild);
  }
}

// ============================================
// Status Updates
// ============================================

function updateStatus(connected, serverUrl) {
  isConnected = connected;

  if (connected) {
    statusIndicator.className = 'status-indicator connected';
    statusText.textContent = 'Connected';
    btnSnapshot.disabled = false;
    btnExtract.disabled = false;
    btnExecuteJs.disabled = false; // Enable EXECUTE_JS when connected
  } else {
    statusIndicator.className = 'status-indicator disconnected';
    statusText.textContent = 'Disconnected';
    btnSnapshot.disabled = true;
    btnExtract.disabled = true;
  }

  if (serverUrl) {
    serverUrlEl.textContent = serverUrl;
  }
}

// ============================================
// Event Handlers
// ============================================

btnSnapshot.addEventListener('click', async () => {
  addLog('Getting snapshot...');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      addLog('No active tab', 'error');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SNAPSHOT' });
    if (response) {
      addLog(`Snapshot: ${response.title?.slice(0, 30) || 'no title'}`, 'success');
    }
  } catch (error) {
    addLog(`Snapshot failed: ${error.message}`, 'error');
  }
});

btnExtract.addEventListener('click', async () => {
  addLog('Extracting DOM...');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      addLog('No active tab', 'error');
      return;
    }

    // Extract common selectors for testing
    const testSelectors = {
      title: 'h1',
      links: 'a[href]',
      images: 'img[src]',
    };

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_DOM',
      params: { selectors: testSelectors },
    });

    if (response?.elements) {
      const count = Object.values(response.elements).flat().length;
      addLog(`Extracted ${count} elements`, 'success');
    }
  } catch (error) {
    addLog(`Extract failed: ${error.message}`, 'error');
  }
});

btnReconnect.addEventListener('click', () => {
  addLog('Reconnecting...');
  chrome.runtime.sendMessage({ type: 'RECONNECT' }, (response) => {
    if (response?.success) {
      addLog('Reconnection triggered', 'success');
    }
  });
});

// ============================================
// Iteration 2: Debug Commands
// ============================================

btnExecuteJs.addEventListener('click', async () => {
  addLog('EXECUTE_JS: Showing alert...');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      addLog('No active tab', 'error');
      return;
    }

    // Send to service worker, which will execute via chrome.scripting.executeScript
    chrome.runtime.sendMessage({
      type: 'DEBUG_EXECUTE_JS',
      script: "alert('Explorer Agent says hello!'); document.body.style.backgroundColor = '#ff6b6b';",
      args: {},
    }, (response) => {
      if (response?.success) {
        addLog(`JS executed: ${response.output || 'ok'}`, 'success');
      } else {
        addLog(`JS failed: ${response?.error || 'unknown'}`, 'error');
      }
    });
  } catch (error) {
    addLog(`EXECUTE_JS failed: ${error.message}`, 'error');
  }
});

btnStartMonitor.addEventListener('click', () => {
  addLog('START_NETWORK_MONITORING...');
  chrome.runtime.sendMessage({ type: 'DEBUG_START_MONITOR' }, (response) => {
    if (response?.success) {
      monitoringId = response.monitoringId;
      monitoringActive = true;
      btnGetLog.disabled = false;
      btnStopMonitor.disabled = false;
      btnStartMonitor.disabled = true;
      addLog(`Monitor started: ${monitoringId}`, 'success');
    } else {
      addLog(`Start monitor failed: ${response?.error || 'already active'}`, 'error');
    }
  });
});

btnGetLog.addEventListener('click', () => {
  if (!monitoringId) {
    addLog('No active monitoring session', 'error');
    return;
  }
  addLog('GET_NETWORK_LOG...');
  chrome.runtime.sendMessage({
    type: 'DEBUG_GET_NETWORK_LOG',
    monitoringId,
  }, (response) => {
    if (response?.success) {
      const count = response.calls?.length || 0;
      addLog(`Network calls: ${count}`, 'success');
      if (count > 0) {
        // Log first few calls
        response.calls.slice(0, 3).forEach((call: any) => {
          addLog(`  ${call.method} ${call.url.slice(0, 50)}... ${call.status}`);
        });
        if (count > 3) {
          addLog(`  ... and ${count - 3} more`);
        }
      }
    } else {
      addLog(`Get log failed: ${response?.error || 'unknown'}`, 'error');
    }
  });
});

btnStopMonitor.addEventListener('click', () => {
  if (!monitoringId) {
    addLog('No active monitoring session', 'error');
    return;
  }
  addLog('STOP_NETWORK_MONITORING...');
  chrome.runtime.sendMessage({
    type: 'DEBUG_STOP_MONITOR',
    monitoringId,
  }, (response) => {
    if (response?.success) {
      addLog(`Monitor stopped. Calls: ${response.totalCallsCaptured}, Duration: ${response.duration}ms`, 'success');
    } else {
      addLog(`Stop monitor failed: ${response?.error || 'invalid id'}`, 'error');
    }
    monitoringId = null;
    monitoringActive = false;
    btnGetLog.disabled = true;
    btnStopMonitor.disabled = true;
    btnStartMonitor.disabled = false;
  });
});

// ============================================
// Initialization
// ============================================

async function init() {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (status) {
      updateStatus(status.connected, status.serverUrl);
      addLog(status.connected ? 'Connected to server' : 'Not connected');
    }
  } catch (error) {
    addLog('Failed to get status', 'error');
  }
}

// Poll for status updates
init();
const statusInterval = setInterval(init, 3000);

// Cleanup on unload
window.addEventListener('unload', () => {
  clearInterval(statusInterval);
});