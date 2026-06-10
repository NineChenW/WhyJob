# Current Feature

## Status

<!-- Not Start / In Progress / Completed -->
In Progress

## Goals

- Create Chrome Extension project structure with Manifest V3
- Implement Service Worker for WebSocket message handling
- Build 3 commands: NAVIGATE, GET_SNAPSHOT, EXTRACT_DOM
- Handle WebSocket reconnection gracefully
- No persistent background processes when idle

### NAVIGATE(url)
- Navigate browser to specified URL
- Wait for page load (networkidle or 5s timeout)
- Returns: `{ success: boolean, url: string, title: string, error?: string }`

### GET_SNAPSHOT()
- Capture current page state
- Returns: `{ url, title, html, visibleText (first 5000 chars), networkCalls, timestamp }`
- NetworkCalls: `Array<{ url, method, status, responseType }>`

### EXTRACT_DOM(selectors)
- Input: `{ selectors: Record<string, string> }` e.g. `{ title: 'h1', jobs: '.job-listing' }`
- Returns: `{ elements: Record<string, Array<{ tag, text (max 200 chars), href?, src?, rect? }>> }`

### WebSocket Protocol
```
Server ── CONNECT ──> Extension (on load)
Server <── EXTENSION_ID ── Extension
Server ── COMMAND { type, params, requestId } ──> Extension
Server <── RESULT { requestId, data, error? } ─── Extension
```

### Error Handling
- Timeout after 10s for navigation
- Return error object on failure (don't throw)
- Log errors for debugging
- Handle WebSocket reconnection gracefully

## Notes

### Tech Requirements
- Manifest V3 Chrome Extension
- Service Worker for message handling (not persistent background page)
- Standard WebSocket API for real-time communication
- Extension ID sent to server on connect

### What NOT to build in Iteration 1
- TEST_API command
- EXECUTE_SCRIPT command
- These come in Iteration 2+

### Project Structure
```
explorer-extension/
├── manifest.json          # Manifest V3
├── service-worker.ts       # WebSocket + command handling
├── content-script.ts      # DOM manipulation for EXTRACT_DOM
├── popup/                  # Optional popup UI
└── assets/
```

### Key Implementation Notes
- Content script injected to all pages for DOM access
- Service worker maintains WebSocket connection
- Commands queued if multiple received concurrently
- Use `chrome.webNavigation` API for NAVIGATE state tracking

### Reference
- Full system design: `@docs/ai-assist-fetch-info-plan.md`
- Chrome Extension Dev: https://developer.chrome.com/docs/extensions/

## History

- **2026-06-10**: Explorer Agent - Chrome Extension Spec (Iteration 1)
- **2026-06-09**: AI Explorer Agent - comprehensive research on AI agent evolution, memory, RAG, workflows. Created plan and 5 spec files for Iteration 1.
- **2026-06-08**: Company Table Add Columns
- **2026-06-07**: Company Batch Create
- **2026-06-06**: Company Batch Import Dialog
- **2026-06-05**: Company Create (Modal Dialog)
- **2026-06-04**: Dashboard Company Spec
- **2026-06-03**: Database Seed Script
- **2026-06-02**: Prisma + Neon PostgreSQL Setup
- **2026-06-01**: Company View Phase 1
- **2026-05-27**: Dashboard UI Phase 1-2
- **2026-05-26**: Initial Next.js and Tailwind CSS v4 setup
