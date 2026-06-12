// API route for extension to post command results
// POST /api/agent/results
// GET /api/agent/results?extensionId=xxx (for agent to poll)

import { NextRequest, NextResponse } from 'next/server';
import { addResult, getResults } from '@/lib/http/relay';
import { postResultsRequestSchema } from '@/schemas/explorer';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = postResultsRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { extensionId, results } = parsed.data;

    // Store results
    for (const result of results) {
      addResult(extensionId, result);
      console.log(
        `[API] Result received: ${result.requestId} - ${
          result.success ? 'success' : 'error'
        }`
      );
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to parse results:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// Agent polls for results
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const extensionId = searchParams.get('extensionId');

  if (!extensionId) {
    return NextResponse.json(
      { error: 'extensionId required' },
      { status: 400 }
    );
  }

  const results = getResults(extensionId);
  return NextResponse.json({ results });
}