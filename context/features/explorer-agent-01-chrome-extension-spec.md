# Explorer Agent - Chrome Extension Spec

## Overview

Chrome Extension serves as AI's "eyes and hands" in the browser. It receives commands from the Explorer Agent via **HTTP polling** and executes browser actions, returning results for AI to analyze.

**Iteration 1 Scope**: Basic 3 commands only - NAVIGATE, GET_SNAPSHOT, EXTRACT_DOM

## Requirements

### Extension Architecture

- Manifest V3 Chrome Extension
- Service Worker for message handling
- **HTTP polling** for command fetch and result posting
- No persistent background processes when idle

### Commands (Iteration 1)

#### 1. NAVIGATE(url)
- Navigate browser to specified URL
- Wait for page load (networkidle or 5s timeout)
- Returns: { success: boolean, url: string, title: string, error?: string }

#### 2. GET_SNAPSHOT()
- Capture current page state
- Returns:
  ```typescript
  {
    url: string;
    title: string;
    html: string;           // Full HTML or body innerHTML
    visibleText: string;    // First 5000 chars of body text
    networkCalls: Array<{   // XHR/fetch intercepts
      url: string;
      method: string;
      status: number;
      responseType: string;
    }>;
    timestamp: Date;
  }
  ```

#### 3. EXTRACT_DOM(selectors)
- Query elements by CSS selectors
- Input: { selectors: Record<string, string> } // e.g., { title: 'h1', jobs: '.job-listing' }
- Returns:
  ```typescript
  {
    elements: Record<string, Array<{
      tag: string;
      text: string;        // innerText, max 200 chars
      href?: string;       // if anchor tag
      src?: string;       // if img tag
      rect?: { x, y, width, height };  // bounding rect
    }>>;
  }
  ```

### HTTP Polling Protocol

```
Extension                         Server
  │                                  │
  │──── GET /commands ──────────────▶│  (poll every 2s)
  │◄─── { commands: [...] } ──────────│
  │                                  │
  │  (execute command in browser)     │
  │                                  │
  │──── POST /results ──────────────▶│
  │       { results: [...] }        │
  │◄─── { success: true } ───────────│
```

### API Endpoints

#### GET /api/agent/commands
Poll for pending commands.

Query params: `?extensionId=xxx`

Response:
```typescript
{
  commands: Command[];
  serverUrl?: string;  // if server URL changed
}
```

#### POST /api/agent/results
Post command execution results.

Body:
```typescript
{
  extensionId: string;
  results: CommandResult[];
}
```

### Error Handling

- Timeout after 10s for navigation
- Return error object on failure (don't throw)
- Log errors for debugging

## Reference

- `@docs/ai-assist-fetch-info-plan.md` - Full system design
- Chrome Extension Dev: https://developer.chrome.com/docs/extensions/

## Notes

- Only 3 commands for Iteration 1 - keep it minimal
- TEST_API and EXECUTE_SCRIPT come in Iteration 2+
- Extension polls every 2 seconds by default
- No extensionId required - uses shared bucket for testing