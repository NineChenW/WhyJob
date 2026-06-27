/**
 * Manual test script for Explorer Agent (LangGraph-based)
 *
 * This script tests the new LangGraph-based explorer with checkpointer.
 * The exploration flow now uses:
 * 1. createExplorerGraph() - builds the state graph
 * 2. runExplorerGraph() - runs with PostgresSaver checkpointer
 * 3. interrupt()/Command({ resume }) - handles async tool execution
 *
 * For full end-to-end testing:
 * 1. Start dev server: npm run dev
 * 2. Start extension test server: cd explorer-extension && node test-server.mjs
 * 3. Submit a task via the API and watch logs
 *
 * Note: The old HttpExtension-based explore() function has been replaced.
 * Use POST /api/explorer/tasks/pickup to pick up tasks.
 */

import { createExplorerGraph, getCheckpointer, ChromeExtensionTool } from '../src/lib/ai';

const SERVER_URL = process.argv[2] || 'http://localhost:3001';

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   Explorer Agent Test (LangGraph)                         ║
║   Server: ${SERVER_URL.padEnd(41)}║
╚══════════════════════════════════════════════════════════╝
`);

  console.log('[Test] Checking LangGraph checkpointer setup...');

  try {
    const checkpointer = await getCheckpointer();
    console.log('[Test] Checkpointer ready:', !!checkpointer);

    const graph = createExplorerGraph();
    console.log('[Test] Graph created:', !!graph);

    // Test tool creation
    const tool = new ChromeExtensionTool(SERVER_URL, 'test-task');
    console.log('[Test] ChromeExtensionTool created:', !!tool);

    console.log('\n✅ All components initialized successfully');
    console.log('\nNote: Full exploration requires:');
    console.log('  1. Start extension test server: cd explorer-extension && node test-server.mjs');
    console.log('  2. Use POST /api/explorer/tasks/pickup to pick up a task');
    console.log('  3. Extension will poll /api/agent/commands and POST results to /api/agent/results\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);