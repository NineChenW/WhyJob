// src/lib/ai/agents/explorer/tools/chrome-extension.ts

import type { ExplorationAction, ToolInput, ToolOutput } from '../types';

/**
 * Chrome Extension Tool for LangGraph
 *
 * This tool provides browser automation capabilities for web exploration.
 * It communicates with a Chrome Extension via HTTP commands.
 */
export class ChromeExtensionTool {
  name = 'chrome_extension';
  description = 'Control Chrome browser for web exploration. Navigate to pages, capture content, extract DOM, execute JavaScript, monitor network requests.';

  private serverUrl: string;
  private taskId: string;
  private requestCounter = 0;

  constructor(serverUrl: string, taskId: string) {
    this.serverUrl = serverUrl;
    this.taskId = taskId;
  }

  /**
   * Invoke a tool action
   */
  async invoke(input: ToolInput): Promise<ToolOutput> {
    const { action, params = {} } = input;
    this.requestCounter++;

    const requestId = `req-${this.requestCounter}-${Date.now()}`;
    const command = this.buildCommand(action, params, requestId);

    // Send command to server relay
    await this.sendCommand(command);

    // Wait for result
    const result = await this.waitForResult(requestId, 30000);

    return result as ToolOutput;
  }

  private buildCommand(
    action: ExplorationAction,
    params: Record<string, unknown>,
    requestId: string
  ) {
    const base = { type: action, requestId };

    switch (action) {
      case 'NAVIGATE':
        return { ...base, params: { url: params.url } };
      case 'GET_SNAPSHOT':
        return base;
      case 'EXTRACT_DOM':
        return { ...base, params: { selectors: params.selectors } };
      case 'EXECUTE_JS':
        return { ...base, params: { script: params.script, args: params.args ?? {} } };
      case 'START_NETWORK_MONITORING':
        return base;
      case 'GET_NETWORK_LOG':
        return { ...base, params: { monitoringId: params.monitoringId, filter: params.filter } };
      case 'STOP_NETWORK_MONITORING':
        return { ...base, params: { monitoringId: params.monitoringId } };
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async sendCommand(command: unknown): Promise<void> {
    const response = await fetch(`${this.serverUrl}/api/agent/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: this.taskId, commands: [command] }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send command: ${response.statusText}`);
    }
  }

  private async waitForResult(requestId: string, timeoutMs: number): Promise<ToolOutput> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const response = await fetch(
        `${this.serverUrl}/api/agent/results?taskId=${this.taskId}&requestId=${requestId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          return data.result;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Timeout waiting for result: ${requestId}`);
  }
}