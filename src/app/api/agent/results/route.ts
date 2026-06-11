// API route for extension to post command results
// POST /api/agent/results
// GET /api/agent/results?extensionId=xxx (for agent to poll)

import { NextRequest, NextResponse } from 'next/server';

interface CommandResult {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

interface ResultPayload {
  extensionId: string;
  results: CommandResult[];
}

// Store results for the agent to fetch
const resultStore = new Map<string, CommandResult[]>();

export function addResult(extensionId: string, result: CommandResult): void {
  const existing = resultStore.get(extensionId) || [];
  existing.push(result);
  resultStore.set(extensionId, existing);
}

export function getResults(extensionId: string): CommandResult[] {
  const results = resultStore.get(extensionId) || [];
  resultStore.delete(extensionId);
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const payload: ResultPayload = await request.json();

    if (!payload.extensionId || !payload.results) {
      return NextResponse.json(
        { error: 'extensionId and results required' },
        { status: 400 }
      );
    }

    // Store results
    for (const result of payload.results) {
      addResult(payload.extensionId, result);
      console.log(`[API] Result received: ${result.requestId} - ${result.success ? 'success' : 'error'}`);
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

export { resultStore };