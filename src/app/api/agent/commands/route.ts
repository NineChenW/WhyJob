// API route for extension to poll commands
// GET /api/agent/commands?extensionId=xxx

import { NextRequest, NextResponse } from 'next/server';
import { getCommands, addCommands } from '@/lib/http/relay';
import { commandSchema } from '@/schemas/explorer';

// Get pending commands for an extension (consumes from queue)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const extensionId = searchParams.get('extensionId');

  if (!extensionId) {
    return NextResponse.json(
      { error: 'extensionId required' },
      { status: 400 }
    );
  }

  const commands = getCommands(extensionId);

  const response = {
    commands,
    serverUrl: '', // Keep same URL
  };

  return NextResponse.json(response);
}

// DEBUG: Add commands to the queue (for manual testing)
// POST /api/agent/debug/commands
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { extensionId, commands } = body;

    if (!extensionId || !commands || !Array.isArray(commands)) {
      return NextResponse.json(
        { error: 'extensionId and commands array required' },
        { status: 400 }
      );
    }

    // Validate each command
    const validCommands = [];
    for (const cmd of commands) {
      const parsed = commandSchema.safeParse(cmd);
      if (parsed.success) {
        validCommands.push(parsed.data);
      } else {
        console.warn('[DEBUG] Invalid command:', parsed.error.issues);
      }
    }

    if (validCommands.length > 0) {
      addCommands(extensionId, validCommands);
      console.log(`[DEBUG] Added ${validCommands.length} command(s) for ${extensionId}`);
    }

    return NextResponse.json({
      success: true,
      added: validCommands.length,
      commands: validCommands,
    });
  } catch (error) {
    console.error('[DEBUG] Failed to add commands:', error);
    return NextResponse.json(
      { error: 'Failed to add commands' },
      { status: 500 }
    );
  }
}