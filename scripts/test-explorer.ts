/**
 * Manual test script for Explorer Agent
 *
 * Usage:
 *   1. Start the test server: cd explorer-extension && node test-server.mjs
 *   2. Run this script: npx tsx scripts/test-explorer.ts
 *
 * Or point to the Next.js dev server:
 *   npx tsx scripts/test-explorer.ts http://localhost:3000
 */

import { explore, HttpExtension, type ExplorationTask } from '../src/lib/ai';

const serverUrl = process.argv[2] || 'http://localhost:3001';

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   Explorer Agent Test                                    ║
║   Server: ${serverUrl.padEnd(41)}║
╚══════════════════════════════════════════════════════════╝
`);

  // Create HTTP extension
  const extension = new HttpExtension(serverUrl);
  console.log('[Test] Connecting to server...');

  try {
    await extension.connect();
    console.log('[Test] Connected to server\n');
  } catch (error) {
    console.error('[Test] Failed to connect:', error);
    console.log('\nMake sure the test server is running:');
    console.log('  cd explorer-extension && node test-server.mjs\n');
    process.exit(1);
  }

  // Test task
  const task: ExplorationTask = {
    companyId: 'test-stripe',
    company: {
      name: 'Stripe',
      website: 'https://stripe.com',
      industry: 'fintech',
    },
    contentTypes: ['jobs'],
  };

  console.log('[Test] Starting exploration for:', task.company.name);
  console.log('[Test] Target:', task.contentTypes.join(', '));
  console.log('[Test] Max iterations:', 5);
  console.log('');

  try {
    const result = await explore(task, extension);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('RESULT:');
    console.log('═══════════════════════════════════════════════════════');

    if (result.success && result.config) {
      console.log('\n✅ SUCCESS');
      console.log('\nFetchConfig:');
      console.log('  Name:', result.config.name);
      console.log('  URL:', result.config.url);
      console.log('  Method:', result.config.method);
      console.log('  ParseWith:', result.config.parseWith);
      console.log('  AuthRequired:', result.config.authRequired);
      console.log('  Confidence:', result.config.confidence);
      if (result.config.selectors) {
        console.log('  Selectors:', JSON.stringify(result.config.selectors, null, 2));
      }
      if (result.config.pagination) {
        console.log('  Pagination:', JSON.stringify(result.config.pagination));
      }
    } else {
      console.log('\n❌ FAILED:', result.reason);
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error);
  } finally {
    extension.disconnect();
    console.log('\n[Test] Disconnected');
  }
}

main().catch(console.error);