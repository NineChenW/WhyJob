// Popup UI Script

const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const serverUrlEl = document.getElementById('serverUrl');
const logEl = document.getElementById('log');
const btnSnapshot = document.getElementById('btnSnapshot');
const btnExtract = document.getElementById('btnExtract');
const btnReconnect = document.getElementById('btnReconnect');

let isConnected = false;

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