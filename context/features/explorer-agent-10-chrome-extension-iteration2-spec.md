# Explorer Agent - Chrome Extension Spec (Iteration 2)

## Overview

Chrome Extension serves as AI's "eyes and hands" in the browser. This spec covers **Iteration 2** additions: **Network Interceptor** and **JavaScript Executor** commands.

**Iteration 2 Scope**: Add network interception to capture API calls during exploration, and JavaScript executor to trigger dynamic content loading.

## New Commands (Iteration 2)

### 1. EXECUTE_JS(script, args?)

Execute arbitrary JavaScript in the page context to trigger dynamic content loading.

**Use Cases**:
- Click "Load More" buttons to reveal hidden content
- Scroll down to trigger lazy loading
- Expand accordions or tabs to reveal hidden sections
- Trigger API calls that only fire on user interaction

**Input**:
```typescript
{
  script: string;           // JavaScript code to execute
  args?: Record<string, unknown>;  // Arguments to make available as `args.keyName`
}
```

**Returns**:
```typescript
{
  success: boolean;
  output?: string;          // console.log output (first 1000 chars)
  error?: string;
  duration: number;          // Execution time in ms
}
```

**Example**:
```javascript
// Input
{
  "script": "document.querySelector('.load-more-btn').click()",
  "args": {}
}

// Or with args
{
  "script": "window.scrollTo(0, args.y)",
  "args": { "y": 500 }
}
```

**Implementation Notes**:
- Script runs in content script context via `chrome.scripting.executeScript`
- `args` object is injected and accessible via `args.keyName` in script
- Capture `console.log` output during execution
- Timeout after 5 seconds
- Return any returned value as `output`

### 2. START_NETWORK_MONITORING()

Begin capturing network requests/responses for analysis.

**Use Cases**:
- Discover hidden API endpoints used by the page
- Capture JSON responses from AJAX calls
- Identify which network calls contain job data
- Analyze pagination patterns from API calls

**Returns**:
```typescript
{
  success: boolean;
  monitoringId: string;     // ID to use with GET_NETWORK_LOG
  message: string;          // "Network monitoring started"
}
```

**Implementation Notes**:
- Uses `chrome.webRequest.onCompleted` listener in service worker
- Filters for XHR and fetch requests
- Stores calls in memory (cleared on service worker restart)
- Maximum 500 calls stored (FIFO)
- Monitoring continues until `STOP_NETWORK_MONITORING` is called

### 3. GET_NETWORK_LOG(monitoringId?)

Retrieve captured network calls since monitoring started.

**Input**:
```typescript
{
  monitoringId?: string;    // Optional - if omitted, returns all since last call
  filter?: {
    urlPattern?: string;    // Regex pattern to filter URLs
    methods?: string[];     // e.g., ['GET', 'POST']
    statusRange?: '2xx' | '3xx' | '4xx' | '5xx';
  };
}
```

**Returns**:
```typescript
{
  calls: Array<{
    id: string;
    url: string;
    method: string;
    status: number;
    responseType: string;     // 'xhr' | 'fetch' | 'document' | 'other'
    timing: number;           // Request duration in ms
    requestHeaders: Record<string, string>;
    responseHeaders: Record<string, string>;
    responseBody?: string;    // First 10KB of response (if parseable)
    timestamp: Date;
  }>;
  count: number;
  hasMore: boolean;           // true if > 500 calls captured
}
```

**Implementation Notes**:
- `monitoringId` maps to a specific monitoring session
- Without `monitoringId`, returns only new calls since last `GET_NETWORK_LOG` call
- `responseBody` truncated to 10KB, only for JSON/text responses
- Use `filter.urlPattern` to find specific API endpoints (e.g., `/api/jobs`)

### 4. STOP_NETWORK_MONITORING(monitoringId)

Stop capturing network requests for a monitoring session.

**Input**:
```typescript
{
  monitoringId: string;
}
```

**Returns**:
```typescript
{
  success: boolean;
  totalCallsCaptured: number;
  duration: number;          // Monitoring duration in ms
}
```

## Updated GET_SNAPSHOT

`GET_SNAPSHOT` now includes network calls captured since navigation:

```typescript
{
  url: string;
  title: string;
  html: string;
  visibleText: string;
  networkCalls: Array<{
    id: string;
    url: string;
    method: string;
    status: number;
    responseType: string;
    timing: number;
  }>;
  timestamp: Date;
}
```

## Command Execution Flow for Network Discovery

```
1. NAVIGATE(url)                    // Go to careers page
2. START_NETWORK_MONITORING()        // Begin capturing API calls
3. EXECUTE_JS({ script: "scrollTo(0, 500)" })  // Trigger lazy load
4. WAIT(1000)                       // Let network calls settle
5. EXECUTE_JS({ script: "document.querySelector('.show-more').click()" })
6. WAIT(1000)
7. GET_NETWORK_LOG()                // Get all captured calls
8. STOP_NETWORK_MONITORING()
```

## Error Handling

| Command | Timeout | Error Response |
|---------|---------|----------------|
| EXECUTE_JS | 5s | `{ success: false, error: "Script timeout after 5000ms" }` |
| START_NETWORK_MONITORING | - | `{ success: false, error: "Monitoring already active" }` |
| GET_NETWORK_LOG | - | `{ calls: [], count: 0, hasMore: false }` |
| STOP_NETWORK_MONITORING | - | `{ success: false, error: "Invalid monitoringId" }` |

## API Endpoints

No changes to HTTP polling protocol. Commands are added to the existing command queue.

## Service Worker Updates

### New Permissions Required

```json
{
  "permissions": [
    "webRequest",
    "scripting",
    "webNavigation"
  ],
  "host_permissions": ["<all_urls>"]
}
```

### Data Structures

```typescript
// In-memory network call storage
interface NetworkCallStore {
  [monitoringId: string]: {
    calls: CapturedNetworkCall[];
    startTime: number;
  };
}

// Service worker state
let networkMonitoringActive = false;
let activeMonitoringId: string | null = null;
let capturedCalls: CapturedNetworkCall[] = [];
let lastGetNetworkLogTime = 0;
```

## Content Script Updates

### New Message Handlers

```typescript
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXECUTE_JS') {
    const result = executeUserScript(message.script, message.args);
    sendResponse(result);
    return true;
  }
  // ... existing handlers
});

async function executeUserScript(
  script: string,
  args: Record<string, unknown> = {}
): Promise<JsExecutionResult> {
  // Use chrome.scripting.executeScript in MV3
  // Capture console.log output
  // Return result or error
}
```

## Reference

- `@docs/ai-assist-fetch-info-plan.md` - Full system design (lines 1965-1969)
- `@context/features/explorer-agent-01-chrome-extension-spec.md` - Iteration 1 base spec
- Chrome API Docs:
  - https://developer.chrome.com/docs/extensions/reference/scripting/
  - https://developer.chrome.com/docs/extensions/reference/webRequest/

## Notes

- Network monitoring requires `<all_urls>` host permission
- JavaScript execution is sandboxed to content script context
- Network calls stored in service worker memory (lost on restart)
- Use `EXECUTE_JS` sparingly - direct DOM manipulation via `EXTRACT_DOM` is preferred
- Network monitoring is per-session (one active session at a time)