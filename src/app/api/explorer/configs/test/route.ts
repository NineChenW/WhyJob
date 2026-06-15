/**
 * Test FetchConfig API
 *
 * POST /api/explorer/configs/test
 *
 * Tests a FetchConfig by making an actual HTTP request
 * before it's saved. Validates the config works for
 * server-side fetching.
 */

import { NextRequest, NextResponse } from 'next/server';
import { testFetchConfig, runFullConfigTest } from '@/lib/fetch';
import type { FetchConfig } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config, fullTest = false } = body;

    if (!config || !config.url) {
      return NextResponse.json(
        { error: 'config with url is required' },
        { status: 400 }
      );
    }

    // Run basic test
    const result = await testFetchConfig(config as FetchConfig);

    // If fullTest is requested, also test pagination
    if (fullTest && result.success) {
      const fullResults = await runFullConfigTest(config as FetchConfig);
      return NextResponse.json({
        success: fullResults.basic.success,
        testResult: fullResults.basic,
        pagination: fullResults.pagination,
        validation: fullResults.validation,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Failed to test config:', error);
    return NextResponse.json(
      { error: 'Failed to test config', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}