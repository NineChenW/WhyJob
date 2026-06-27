// src/lib/ai/agents/explorer/nodes/test-config.ts

/**
 * Test Config Node
 *
 * Validates the generated FetchConfig before returning success.
 * Tests the config by making an actual HTTP request to ensure it works.
 *
 * - If test passes (success + items found): confidence boost +10
 * - If test fails: confidence penalty -30, config set to undefined
 */

import { ExplorationStateWrapper } from '../domain';
import { createNode } from '../node-wrapper';
import { testFetchConfig, type FetchConfigTestResult } from '@/lib/fetch/config-tester';
import type { ExplorationResultData } from '../types';

/**
 * Test Config Node
 *
 * Validates the generated FetchConfig by making an actual HTTP request.
 */
export const testConfigNode = createNode(async (wrapper: ExplorationStateWrapper) => {
  const result = wrapper.result;

  if (!result?.config) {
    wrapper.setResult({
      success: false,
      taskId: wrapper.task.taskId,
      status: 'failed',
      confidence: 0,
    });
    return wrapper;
  }

  // Convert local FetchConfig to Prisma-compatible format for testFetchConfig
  const prismaConfig: Parameters<typeof testFetchConfig>[0] = {
    id: result.config.companyId,
    companyId: result.config.companyId,
    name: result.config.name,
    contentType: result.config.contentType,
    url: result.config.url,
    method: result.config.method,
    headers: result.config.headers as object,
    params: result.config.params as object,
    parseWith: result.config.parseWith,
    selectors: (result.config.selectors as object | null) ?? null,
    pagination: (result.config.pagination as object | null) ?? null,
    authRequired: result.config.authRequired,
    authNote: result.config.authNote ?? null,
    isActive: result.config.isActive,
    intervalHours: result.config.intervalHours ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testResult: FetchConfigTestResult = await testFetchConfig(prismaConfig, {
    timeout: 15000,
    maxItems: 5,
  });

  const configValid = testResult.success && (testResult.itemCount ?? 0) > 0;
  const finalConfidence = configValid
    ? Math.min(100, (result.confidence ?? 0) + 10)
    : Math.max(0, (result.confidence ?? 0) - 30);

  wrapper.setResult({
    ...result,
    status: configValid ? 'complete' : 'failed',
    confidence: finalConfidence,
    reason: !configValid
      ? `Config test failed: ${testResult.error ?? 'No items returned'}`
      : result.reason,
    config: configValid ? result.config : undefined,
  });

  return wrapper;
});