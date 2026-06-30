# Explorer Agent Browser Extension

A Manifest V3 Chrome extension that enables AI-powered web browsing and automation for the WhyJob Explorer Agent. The extension polls a server for commands, executes them in an isolated browser window, and posts results back.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                          │
│                                                                  │
│  ┌──────────────────┐    ┌────────────────────────────────────┐ │
│  │   Popup UI       │    │         Service Worker             │ │
│  │   (popup.ts)     │    │      (service-worker.ts)           │ │
│  │                  │    │                                     │ │
│  │  • Debug testing │    │  • HTTP polling loop               │ │
│  │  • Status view   │    │  • Command execution               │ │
│  │  • Manual cmds   │    │  • Task window management          │ │
│  └──────────────────┘    └──────────────┬─────────────────────┘ │
│                                         │                       │
│                          ┌──────────────┴─────────────────────┐ │
│                          │        Content Script              │ │
│                          │     (content-script.ts)             │ │
│                          │                                      │ │
│                          │  • DOM extraction                   │ │
│                          │  • Page snapshot capture            │ │
│                          │  • Network call tracking           │ │
│                          └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Server (Next.js)                            │
│                                                                  │
│  GET  /api/agent/commands  →  PollResponse { commands[] }       │
│  POST /api/agent/results  ←  ResultPayload { results[] }        │
│  POST /api/explorer/tasks/pickup                                │
└─────────────────────────────────────────────────────────────────┘
```

## Manifest V3 (MV3) Overview

Chrome Extensions built with Manifest V3 use a **service worker** as the background backbone instead of persistent background pages. MV3 enforces stricter security, uses `chrome.scripting` APIs for code injection, and limits host permissions.

### Extension Components

| Component | File | Runs In | Access |
|-----------|------|---------|--------|
| **Service Worker** | `service-worker.ts` | Browser backend | Chrome APIs, HTTP, windows/tabs |
| **Content Script** | `content-script.ts` | Web page context | DOM of the page it injects into |
| **Popup** | `popup.ts` + `popup.html` | Extension popup UI | Limited to browser action area |
| **Web Page** | (none) | Your application | Direct DOM access |

### Core Concepts

#### Service Worker (Background Script)
The service worker is a stateless, event-driven script that:
- Handles all extension logic that needs to persist across page loads
- Manages windows, tabs, and coordinates content scripts
- Makes HTTP requests to your server
- Responds to user interactions via message passing

**Key characteristics:**
- Runs in its own global scope
- Can be terminated by Chrome at any time when idle
- Must re-register event listeners on startup
- Communicates via `chrome.runtime` message passing

```typescript
// Service worker lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  // Called on first install or update
});

chrome.runtime.onStartup.addListener(() => {
  // Called when Chrome starts up
});
```

#### Content Scripts
Content scripts run in the context of web pages with direct DOM access but **limited Chrome API access**:

- Read and modify DOM freely
- Communicate with the service worker via `chrome.runtime.sendMessage`
- Cannot make direct HTTP requests (must go through service worker)
- Share no JavaScript scope with the page or other content scripts

```typescript
// Content script receives messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SNAPSHOT') {
    sendResponse(captureSnapshot());
    return true; // Keep channel open for async response
  }
});
```

#### Popup (Browser Action)
The popup is a simple HTML/JS UI shown when the user clicks the extension icon:

- Has direct access to `chrome` APIs via `chrome.runtime`
- Limited lifetime (closed when user clicks away)
- Should not perform long-running operations

#### Message Passing
All components communicate via `chrome.runtime` message passing:

```typescript
// From popup → service worker
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
  // Handle response
});

// From service worker → content script
chrome.tabs.sendMessage(tabId, { type: 'GET_SNAPSHOT' }, (response) => {
  // Handle response
});

// Bidirectional with async/await
chrome.runtime.sendMessage({ type: 'EXECUTE_JS', script: '...' }).then(response => {
  // Handle response
});
```

#### Permissions Model
MV3 uses a capability-based permission system:

```json
{
  "permissions": ["activeTab", "webNavigation", "webRequest", "scripting", "tabs"],
  "host_permissions": ["<all_urls>"]
}
```

| Permission | Purpose |
|-----------|---------|
| `activeTab` | Access to the currently active tab only |
| `scripting` | `chrome.scripting.executeScript` to inject JS |
| `tabs` | `chrome.tabs` API for tab management |
| `webNavigation` | Listen for navigation events |
| `webRequest` | Intercept network requests |
| `host_permissions` | Access to specific host patterns (`<all_urls>` for all) |

#### Web-Accessible Resources
Since MV3, content scripts are no longer automatically accessible. Pages that need to reference extension resources must list them:

```json
{
  "web_accessible_resources": [
    { "resources": ["content-script.js"], "matches": ["<all_urls>"] }
  ]
}
```

### Common Patterns

#### Async Command Execution
Service worker commands return Promises so Chrome handles async responses properly:

```typescript
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'DEBUG_EXECUTE_JS') {
    // Return Promise so Chrome keeps channel open for async response
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        // ... do work
        resolve({ success: true, output: '...' });
      });
    });
  }
  return false;
});
```

#### Task Window Management
Each task runs in its own browser window for isolation:

```typescript
async function createTaskWindow(): Promise<number | null> {
  await closeTaskWindow(); // Close any existing first
  return new Promise((resolve) => {
    chrome.windows.create({ url: 'about:blank', focused: true }, (window) => {
      resolve(window?.id ?? null);
    });
  });
}
```

#### Recursive Polling Loop (vs setInterval)
Use recursive async loops instead of `setInterval` to prevent overlapping cycles:

```typescript
async function pollLoopRecursive(): Promise<void> {
  if (!isPolling || pollLoopRunning) return;
  pollLoopRunning = true;
  try {
    await pollLoopIteration();
  } finally {
    pollLoopRunning = false;
  }
  if (isPolling) {
    setTimeout(pollLoopRecursive, config.pollIntervalMs);
  }
}
```

## Protocol

The extension communicates with the server via HTTP polling:

### GET `/api/agent/commands?taskId=<id>&t=<timestamp>`

Returns `PollResponse`:
```typescript
interface PollResponse {
  commands: Command[];
  serverUrl: string;
  taskStatus?: 'exploring' | 'complete' | 'failed';
  taskId?: string;
}
```

### POST `/api/agent/results`

Sends `ResultPayload`:
```typescript
interface ResultPayload {
  taskId?: string;
  results: CommandResult[];
}
```

## Commands

| Command | Description | Parameters |
|---------|-------------|------------|
| `NAVIGATE` | Navigate task window to URL | `{ url: string }` |
| `GET_SNAPSHOT` | Capture full page state | — |
| `EXTRACT_DOM` | Extract elements by CSS selectors | `{ selectors: Record<string, string> }` |
| `EXECUTE_JS` | Run JavaScript in page context | `{ script: string, args?: Record<string, unknown> }` |
| `START_NETWORK_MONITORING` | Begin capturing XHR/fetch calls | — |
| `GET_NETWORK_LOG` | Retrieve captured network calls | `{ monitoringId?: string, filter?: { urlPattern?, methods?, statusRange? } }` |
| `STOP_NETWORK_MONITORING` | Stop capturing network calls | `{ monitoringId: string }` |

## Configuration

Default config in `types.ts`:
```typescript
const DEFAULT_CONFIG: PollingConfig = {
  serverUrl: 'http://localhost:3000/api/agent',
  pollIntervalMs: 2000,
  connectionTimeoutMs: 10000,
};
```

Override at runtime via `SET_SERVER_URL` message to service worker.

## Task Window Isolation

Each task runs in its own browser window (`chrome.windows.create`) for isolation:
- One window per task
- Window created lazily when first command needs execution
- Window closed when task completes or no commands pending
- Fallback to any window if `currentTaskWindowId` lost

## Debug Popup

The popup provides a manual testing interface:

**Status Section**
- Connection status indicator
- Server URL display
- Last poll timestamp

**Basic Commands (Iteration 1)**
- `Get Snapshot` — capture current tab page state
- `Extract DOM` — extract h1, links, images from current tab
- `Reconnect` — reset polling state

**Network Monitoring (Iteration 2)**
- `START_MONITOR` — begin capturing XHR/fetch calls
- `GET_NETWORK_LOG` — retrieve captured calls
- `STOP_MONITOR` — stop monitoring, get final stats

## File Structure

```
explorer-extension/
├── manifest.json          # Extension manifest (MV3)
├── service-worker.ts      # Main entry: polling, command execution, window management
├── content-script.ts      # Page context: DOM extraction, snapshot capture
├── types.ts               # Shared TypeScript types
├── popup/
│   ├── popup.html         # Debug UI layout
│   └── popup.ts           # Popup interaction logic
├── dist/                  # Built output (load this in Chrome)
├── types.test.ts          # Type constant tests
└── network-filter.test.ts # Network filtering logic tests
```

## Installation

```bash
# Build the extension
npm run build

# Or watch mode for development
npm run watch
```

The compiled extension is in `dist/`. To load it in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `explorer-extension/dist` directory

## Build Output

```
dist/
├── manifest.json
├── service-worker.js
├── content-script.js
└── popup/
    ├── popup.html
    └── popup.js
```

## Tests

```bash
# Run type and filter tests
npm run test
```

Tests cover:
- Type constant values (`types.test.ts`)
- Network call filtering logic (`network-filter.test.ts`)