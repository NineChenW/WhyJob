# Explorer Agent - Chrome Extension

Chrome Extension that serves as AI's "eyes and hands" in the browser. Connects to the Explorer Agent via WebSocket for real-time browser automation.

## Iteration 1 Commands

| Command | Description |
|---------|-------------|
| `NAVIGATE(url)` | Navigate browser to specified URL |
| `GET_SNAPSHOT()` | Capture current page state |
| `EXTRACT_DOM(selectors)` | Extract DOM elements by CSS selectors |

## Setup

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Or watch mode for development
npm run watch
```

## Loading in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

## Architecture

```
explorer-extension/
├── manifest.json          # Manifest V3
├── service-worker.ts       # WebSocket + command handling
├── content-script.ts      # DOM manipulation
├── popup/                  # Optional popup UI
├── types.ts               # Shared TypeScript types
├── build.mjs              # Build script
└── dist/                  # Compiled output
```

## WebSocket Protocol

```
Server ── CONNECT ──> Extension (on load)
Server <── EXTENSION_ID ── Extension
Server ── COMMAND { type, params, requestId } ──> Extension
Server <── RESULT { requestId, data, error? } ─── Extension
```

## Error Handling

- 10s timeout for navigation commands
- Errors returned as objects, not thrown
- Automatic reconnection on disconnect

## Development

The extension uses Chrome's Service Worker (Manifest V3) for:
- WebSocket connection management
- Command routing and execution
- Message passing with content scripts

Content scripts are injected into all pages for:
- DOM manipulation
- Page state capture
- Element extraction

## License

Internal - WhyJob Project




File	Change
types.ts	Replaced WebSocket types with HTTP polling types (PollResponse, ResultPayload)
service-worker.ts	Replaced WebSocket with fetch polling every 2s
src/app/api/agent/commands/route.ts	New API route for extension to poll commands
src/app/api/agent/results/route.ts	New API route for extension to post results
test-server.mjs	Standalone HTTP server on port 3001
New Protocol:


Extension (polls) ──GET /api/agent/commands?extensionId=xxx──> Server
                     <──{ commands: [...] }───────────────── Server

Extension (posts) ──POST /api/agent/results { results: [...] }──> Server
                     <──{ success: true }────────────────────── Server


 it's just a client that polls via HTTP. Something else is on port 3001 from before.

Kill it:


lsof -ti:3001 | xargs kill -9 2>/dev/null
Then start fresh:


cd /Users/luckyjay_hu/ai_workdir/whyjob/explorer-extension
node test-server.mjs

curl -X POST http://localhost:3001/api/agent/commands \
  -H "Content-Type: application/json" \
  -d '{"command":{"type":"GET_SNAPSHOT","requestId":"test-1"}}'


Test commands:
  Add commands via POST to /api/agent/commands:

  # Send GET_SNAPSHOT
  curl -X POST http://localhost:3001/api/agent/commands \
    -H "Content-Type: application/json" \
    -d '{"command":{"type":"GET_SNAPSHOT","requestId":"test-1"}}'

  # Send EXTRACT_DOM
  curl -X POST http://localhost:3001/api/agent/commands \
    -H "Content-Type: application/json" \
    -d '{"command":{"type":"EXTRACT_DOM","requestId":"test-2","params":{"selectors":{"h1":"h1","links":"a[href]"}}}}'

  # Send NAVIGATE
  curl -X POST http://localhost:3001/api/agent/commands \
    -H "Content-Type: application/json" \
    -d '{"command":{"type":"NAVIGATE","requestId":"test-3","params":{"url":"https://example.com"}}}'