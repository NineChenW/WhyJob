// API route for extension to poll commands
// GET /api/agent/commands?extensionId=xxx

import { NextRequest, NextResponse } from 'next/server';

// In-memory command queue for testing
// In production, this would be Redis or database
const commandQueue = new Map<string, Command[]>();

interface Command {
  type: 'NAVIGATE' | 'GET_SNAPSHOT' | 'EXTRACT_DOM';
  requestId: string;
  params?: { url?: string; selectors?: Record<string, string> };
}

interface PollResponse {
  commands: Command[];
  serverUrl: string;
}

// Add a command to the queue for a specific extension
export function addCommand(extensionId: string, command: Command): void {
  const existing = commandQueue.get(extensionId) || [];
  existing.push(command);
  commandQueue.set(extensionId, existing);
}

// Get pending commands for an extension
export function getCommands(extensionId: string): Command[] {
  const commands = commandQueue.get(extensionId) || [];
  commandQueue.delete(extensionId); // Clear after fetch
  return commands;
}

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

  const response: PollResponse = {
    commands,
    serverUrl: '', // Keep same URL
  };

  return NextResponse.json(response);
}

// Export commandQueue for use by test server / agent
export { commandQueue };