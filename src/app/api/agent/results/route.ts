/**
 * Explorer Agent Results API
 *
 * POST /api/agent/results → Extension posts result
 *
 * Queue-only: Manages result idempotency without database.
 * Same result can only be posted once.
 *
 * Flow:
 * 1. Extension POSTs result → Results API marks result as processed
 * 2. Results API logs the result data for debugging/analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isResultProcessed,
  markResultProcessed,
  getResultProcessingInfo,
  extractTaskIdFromRequestId,
} from '@/lib/http/explorer-queue';
import type { ResultPayload } from '@/lib/http/explorer-types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/results
 * Debug endpoint to check result status.
 */
export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId');
  return NextResponse.json({
    message: 'Use POST to post results',
    taskId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/agent/results
 * Receives tool execution results from Chrome Extension.
 * Same result can only be posted once (idempotency via queue).
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Results] Received results request`);

  try {
    const body: ResultPayload = await request.json();
    const { results, taskId: bodyTaskId } = body;

    console.log(`[${timestamp}] [Results] taskId: ${bodyTaskId}, results count: ${results?.length}`);

    if (!results || !Array.isArray(results) || results.length === 0) {
      console.log(`[${timestamp}] [Results] No results to process`);
      return NextResponse.json({ error: 'results required' }, { status: 400 });
    }

    const processedResults: Array<{
      requestId: string;
      success: boolean;
      alreadyProcessed: boolean;
      processedAt?: string;
      taskId?: string;
    }> = [];

    // Process each result
    for (const result of results) {
      console.log(`[${timestamp}] [Results] Processing result:`, {
        requestId: result.requestId,
        success: result.success,
        error: result.error,
      });

      // Extract taskId from requestId
      let taskId: string;
      try {
        taskId = extractTaskIdFromRequestId(result.requestId);
      } catch {
        console.log(`[${timestamp}] [Results] Invalid requestId format: ${result.requestId}`);
        processedResults.push({
          requestId: result.requestId,
          success: false,
          alreadyProcessed: false,
        });
        continue;
      }

      // Check idempotency - same result can only be posted once
      if (isResultProcessed(result.requestId)) {
        const existing = getResultProcessingInfo(result.requestId);
        console.log(`[${timestamp}] [Results] Result already processed (idempotent): ${result.requestId}`);
        processedResults.push({
          requestId: result.requestId,
          success: true,
          alreadyProcessed: true,
          processedAt: existing?.processedAt?.toISOString(),
          taskId,
        });
        continue;
      }

      // Mark as processed BEFORE any other processing
      const isNew = markResultProcessed(result.requestId, taskId);
      console.log(`[${timestamp}] [Results] Result marked as processed: ${result.requestId}, isNew: ${isNew}`);

      // Log the result data for debugging
      console.log(`[${timestamp}] [Results] Result data:`, {
        requestId: result.requestId,
        taskId,
        success: result.success,
        hasData: !!result.data,
        error: result.error,
      });

      processedResults.push({
        requestId: result.requestId,
        success: true,
        alreadyProcessed: false,
        taskId,
      });
    }

    return NextResponse.json({
      success: true,
      results: processedResults,
    });
  } catch (error) {
    console.error(`[${timestamp}] [Results] Error processing results:`, error);
    return NextResponse.json(
      { error: 'Failed to process results', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}