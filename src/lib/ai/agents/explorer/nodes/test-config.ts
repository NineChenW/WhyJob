// src/lib/ai/agents/explorer/nodes/test-config.ts

import type { ExplorationState, ExplorationResult, FetchConfig } from '../types';
import { createStateLog } from '@/lib/ai/state-log';
import { testFetchConfig, type FetchConfigTestResult } from '@/lib/fetch/config-tester';

const AGENT_NAME = 'explorer';

/**
 * Test Config Node
 *
 * Validates the generated FetchConfig before returning success.
 * Tests the config by making an actual HTTP request to ensure it works.
 *
 * - If test passes (success + items found): confidence boost +10
 * - If test fails: confidence penalty -30, config set to undefined
 */
export async function testConfigNode(
  state: ExplorationState
): Promise<Partial<ExplorationState>> {
  const { finalResult, taskId } = state;

  if (!finalResult?.config) {
    await createStateLog({
      taskId,
      agent: AGENT_NAME,
      node: 'test_config',
      state: { finalResult },
      note: { error: 'No config to test' },
      status: 1,
    });
    return {
      finalResult: {
        success: false,
        taskId,
        status: 'failed' as const,
        iterations: finalResult?.iterations ?? 0,
        discoveries: finalResult?.discoveries ?? [],
        confidence: 0,
      },
    };
  }

  // Convert local FetchConfig to Prisma-compatible format for testFetchConfig
  const prismaConfig: Parameters<typeof testFetchConfig>[0] = {
    id: finalResult.config.companyId, // Use companyId as placeholder id
    companyId: finalResult.config.companyId,
    name: finalResult.config.name,
    contentType: finalResult.config.contentType,
    url: finalResult.config.url,
    method: finalResult.config.method,
    headers: finalResult.config.headers as object,
    params: finalResult.config.params as object,
    parseWith: finalResult.config.parseWith,
    selectors: (finalResult.config.selectors as object | null) ?? null,
    pagination: (finalResult.config.pagination as object | null) ?? null,
    authRequired: finalResult.config.authRequired,
    authNote: finalResult.config.authNote ?? null,
    isActive: finalResult.config.isActive,
    intervalHours: finalResult.config.intervalHours ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testResult: FetchConfigTestResult = await testFetchConfig(prismaConfig, {
    timeout: 15000,
    maxItems: 5,
  });

  const configValid = testResult.success && (testResult.itemCount ?? 0) > 0;
  const finalConfidence = configValid
    ? Math.min(100, (finalResult.confidence ?? 0) + 10)
    : Math.max(0, (finalResult.confidence ?? 0) - 30);

  await createStateLog({
    taskId,
    agent: AGENT_NAME,
    node: 'test_config',
    state: { finalResult, configValid, finalConfidence },
    note: {
      configTest: {
        success: testResult.success,
        statusCode: testResult.statusCode,
        itemCount: testResult.itemCount,
        responseTime: testResult.responseTime,
        error: testResult.error,
      },
    },
    status: 1,
  });

  return {
    finalResult: {
      ...(finalResult as ExplorationResult),
      status: configValid ? 'complete' : 'failed',
      confidence: finalConfidence,
      reason: !configValid
        ? `Config test failed: ${testResult.error ?? 'No items returned'}`
        : finalResult.reason,
      config: configValid ? finalResult.config : undefined,
    },
  };
}