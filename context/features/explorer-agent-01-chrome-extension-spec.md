# Explorer Agent - Chrome Extension Spec

## Overview

Chrome Extension serves as AI's "eyes and hands" in the browser. It receives commands from the Explorer Agent via WebSocket and executes browser actions, returning results for AI to analyze.

**Iteration 1 Scope**: Basic 3 commands only - NAVIGATE, SNAPSHOT, EXTRACT_DOM

## Requirements

### Extension Architecture

- Manifest V3 Chrome Extension
- Service Worker for message handling
- WebSocket connection to server for real-time communication
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

### WebSocket Protocol

```
Server                          Extension
  │                                │
  │──── CONNECT (on load) ────────│
  │◄──── EXTENSION_ID ─────────────│
  │                                │
  │──── COMMAND {                  │
  │       type: 'NAVIGATE',       │
  │       params: { url },        │
  │       requestId                │
  │     } ────────────────────────>│
  │◄──── RESULT {                  │
  │       requestId,               │
  │       data,                    │
  │       error?                   │
  │     } ─────────────────────────│
```

### Error Handling

- Timeout after 10s for navigation
- Return error object on failure (don't throw)
- Log errors for debugging

## Reference

- `@docs/ai-assist-fetch-info-plan.md` - Full system design
- Chrome Extension Dev: https://developer.chrome.com/docs/extensions/
- WebSocket client: Use standard WebSocket API

## Notes

- Only 3 commands for Iteration 1 - keep it minimal
- TEST_API and EXECUTE_SCRIPT come in Iteration 2+
- Extension should handle multiple concurrent commands (queue them)
- Need to handle WebSocket reconnection gracefully