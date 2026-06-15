/**
 * Explorer Agent Results API
 *
 * POST /api/agent/results
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Discovery } from '@/lib/db/explorer';
import { analyzeActionResult, type ActionResult } from '@/lib/ai/agents/explorer-act';

interface ResultPayload {
  extensionId: string;
  results: Array<{
    requestId: string;
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Results] Received results request`);

  try {
    const body: ResultPayload = await request.json();
    const { results, extensionId } = body;

    console.log(`[${timestamp}] [Results] extensionId: ${extensionId}, results count: ${results?.length}`);

    if (!results || !Array.isArray(results) || results.length === 0) {
      console.log(`[${timestamp}] [Results] No results to process`);
      return NextResponse.json({ error: 'results required' }, { status: 400 });
    }

    // Process each result
    for (const result of results) {
      console.log(`[${timestamp}] [Results] Processing result:`, {
        requestId: result.requestId,
        success: result.success,
        error: result.error,
      });

      // Extract taskId from requestId (format: "taskId-timestamp")
      const requestIdParts = result.requestId.split('-');
      if (requestIdParts.length < 2) {
        console.log(`[${timestamp}] [Results] Invalid requestId format: ${result.requestId}`);
        continue;
      }

      const taskId = requestIdParts.slice(0, -1).join('-');
      console.log(`[${timestamp}] [Results] Extracted taskId: ${taskId}`);

      // Get current task state
      const task = await prisma.fetchTask.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        console.error(`[${timestamp}] [Results] Task not found: ${taskId}`);
        continue;
      }

      console.log(`[${timestamp}] [Results] Task found:`, {
        id: task.id,
        status: task.status,
        currentAction: task.currentAction,
        currentTarget: task.currentTarget,
        iterations: task.iterations,
      });

      // Fetch company info separately
      const company = await prisma.company.findUnique({
        where: { id: task.companyId },
      });

      // Build state for analysis
      const state = {
        id: task.id,
        companyId: task.companyId,
        company: {
          name: company?.name ?? 'Unknown',
          website: company?.website ?? undefined,
          industry: company?.industry ?? undefined,
        },
        contentTypes: task.contentTypes as string[],
        iterations: task.iterations,
        pagesVisited: task.pagesVisited as string[],
        discoveries: (task.discoveries as unknown as Discovery[]) || [],
        currentAction: task.currentAction,
        currentTarget: task.currentTarget,
      };

      // Analyze the result
      const actionResult: ActionResult = {
        success: result.success,
        url: (result.data as { url?: string })?.url,
        title: (result.data as { title?: string })?.title,
        error: result.error,
        data: result.data,
      };

      console.log(`[${timestamp}] [Results] Action result:`, actionResult);

      const decision: {
        action: 'NAVIGATE' | 'EXTRACT_DOM' | 'TEST_API' | 'GENERATE_CONFIG' | 'FAIL';
        targetUrl?: string;
        selectors?: Record<string, string>;
      } = {
        action: (state.currentAction as 'NAVIGATE' | 'EXTRACT_DOM' | 'TEST_API') ?? 'NAVIGATE',
        targetUrl: state.currentTarget ?? undefined,
        selectors: undefined,
      };

      console.log(`[${timestamp}] [Results] Decision context:`, decision);

      const discovery = analyzeActionResult(decision.action, actionResult, decision);

      console.log(`[${timestamp}] [Results] Discovery:`, discovery);

      // Prepare updates
      const pagesVisited = [...task.pagesVisited];
      if (discovery?.url && !pagesVisited.includes(discovery.url)) {
        pagesVisited.push(discovery.url);
      }

      const discoveries = [...((task.discoveries as unknown as Discovery[]) || [])];
      if (discovery) {
        discoveries.push(discovery);
      }

      console.log(`[${timestamp}] [Results] Updating task with:`, {
        newIterations: task.iterations + 1,
        pagesVisited,
        discoveriesCount: discoveries.length,
      });

      // Update task state
      await prisma.fetchTask.update({
        where: { id: taskId },
        data: {
          iterations: task.iterations + 1,
          pagesVisited,
          discoveries: discoveries as object,
          currentAction: null, // Clear current action - ready for next
          currentTarget: null,
        },
      });

      console.log(`[${timestamp}] [Results] Task ${taskId} updated successfully`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[${timestamp}] [Results] Error processing results:`, error);
    return NextResponse.json(
      { error: 'Failed to process results', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}