// Simple HTTP test server for Explorer Extension
// This mimics the Next.js API routes for local testing
// Run: node test-server.mjs

import http from 'http';
import { URL } from 'url';

const PORT = 3001;

// In-memory stores (same as API routes)
const commandQueue = new Map();
const resultStore = new Map();

function addCommand(extensionId, command) {
  const existing = commandQueue.get(extensionId) || [];
  existing.push(command);
  commandQueue.set(extensionId, existing);
}

function getCommands(extensionId) {
  const commands = commandQueue.get(extensionId) || [];
  commandQueue.delete(extensionId);
  return commands;
}

function getResults(extensionId) {
  const results = resultStore.get(extensionId) || [];
  resultStore.delete(extensionId);
  return results;
}

function addResult(extensionId, result) {
  const existing = resultStore.get(extensionId) || [];
  existing.push(result);
  resultStore.set(extensionId, existing);
}

// Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Parse POST body helper
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/agent/commands - Extension polls for commands
  if (req.method === 'GET' && pathname === '/api/agent/commands') {
    const extensionId = url.searchParams.get('extensionId') || 'test';
    // For testing: check extension's ID first, then fallback to shared buckets
    let commands = getCommands(extensionId);
    if (commands.length === 0) {
      commands = getCommands('test'); // Fallback to test bucket
    }
    if (commands.length === 0 && extensionId.startsWith('explorer-extension-')) {
      commands = getCommands('shared'); // Fallback to shared bucket
    }

    console.log(`[${new Date().toLocaleTimeString()}] POLL from ${extensionId} - ${commands.length} command(s)`);

    json(res, 200, { commands, serverUrl: '' });
    return;
  }

  // Also accept /commands without prefix (for HttpExtension)
  if (req.method === 'GET' && pathname === '/commands') {
    const extensionId = url.searchParams.get('extensionId') || 'test';
    let commands = getCommands(extensionId);
    if (commands.length === 0) commands = getCommands('shared');

    console.log(`[${new Date().toLocaleTimeString()}] POLL from ${extensionId} - ${commands.length} command(s)`);
    json(res, 200, { commands, serverUrl: '' });
    return;
  }

  // POST /commands (for HttpExtension)
  if (req.method === 'POST' && pathname === '/commands') {
    const body = await parseJsonBody(req);
    const extensionId = body.extensionId || 'shared';
    if (body.command) {
      addCommand(extensionId, body.command);
      console.log(`[${new Date().toLocaleTimeString()}] ADDED: ${body.command.type} (${body.command.requestId})`);
    }
    json(res, 200, { success: true });
    return;
  }

  // POST /api/agent/commands - Add commands (for testing)
  if (req.method === 'POST' && pathname === '/api/agent/commands') {
    const body = await parseJsonBody(req);
    // Default to 'shared' bucket for easier testing
    const extensionId = body.extensionId || 'shared';

    if (body.command) {
      addCommand(extensionId, body.command);
      console.log(`[${new Date().toLocaleTimeString()}] ADDED command: ${body.command.type} (${body.command.requestId})`);
    }

    json(res, 200, { success: true });
    return;
  }

  // POST /api/agent/results - Extension posts results
  // Also store in 'shared' bucket for agent testing
  if (req.method === 'POST' && pathname === '/api/agent/results') {
    const body = await parseJsonBody(req);
    const { extensionId, results } = body;

    if (results && Array.isArray(results)) {
      for (const result of results) {
        console.log(`[${new Date().toLocaleTimeString()}] RESULT: ${result.requestId} - ${result.success ? '✓' : '✗'}`);
        if (result.error) console.log(`  Error: ${result.error}`);
        // Store in extension's bucket AND in 'shared' for agent
        addResult(extensionId, result);
        addResult('shared', result);
      }
    }

    json(res, 200, { success: true });
    return;
  }

  // POST /results - Also store in 'shared' for agent
  if (req.method === 'POST' && pathname === '/results') {
    const body = await parseJsonBody(req);
    const { extensionId, results } = body;
    console.log(`[${new Date().toLocaleTimeString()}] POSTED results from ${extensionId}: ${results?.length || 0} result(s)`);
    if (results && Array.isArray(results)) {
      for (const result of results) {
        addResult('shared', result);
      }
    }
    json(res, 200, { success: true });
    return;
  }

  // GET /results - Agent polls for results (for HttpExtension)
  if (req.method === 'GET' && pathname === '/results') {
    const extensionId = url.searchParams.get('extensionId') || 'shared';
    const results = getResults(extensionId);
    console.log(`[${new Date().toLocaleTimeString()}] GET results for ${extensionId}: ${results.length} result(s)`);
    json(res, 200, { results });
    return;
  }

  // 404
  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   Explorer Extension Test Server                           ║
║   HTTP polling server running on port ${PORT}                  ║
╚═══════════════════════════════════════════════════════════╝

Endpoints:
  GET  /api/agent/commands?extensionId=xxx  - Extension polls here
  POST /api/agent/results                    - Extension posts results

Test commands:
  Add commands via POST to /api/agent/commands:

  # Send GET_SNAPSHOT
  curl -X POST http://localhost:${PORT}/api/agent/commands \\
    -H "Content-Type: application/json" \\
    -d '{"command":{"type":"GET_SNAPSHOT","requestId":"test-1"}}'

  # Send EXTRACT_DOM
  curl -X POST http://localhost:${PORT}/api/agent/commands \\
    -H "Content-Type: application/json" \\
    -d '{"command":{"type":"EXTRACT_DOM","requestId":"test-2","params":{"selectors":{"h1":"h1","links":"a[href]"}}}}'

  # Send NAVIGATE
  curl -X POST http://localhost:${PORT}/api/agent/commands \\
    -H "Content-Type: application/json" \\
    -d '{"command":{"type":"NAVIGATE","requestId":"test-3","params":{"url":"https://example.com"}}}'

Ready! Waiting for extension to poll...
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
});