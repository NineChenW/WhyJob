/**
 * Extension Interface Types
 *
 * Defines the contract for communicating with the Chrome Extension.
 * Used by Explorer Agent to send commands and receive results.
 */

export interface ExtensionInterface {
  connect(): Promise<void>;
  disconnect(): void;
  sendCommand(command: ExtensionCommand): Promise<ExtensionResult>;
  navigate(url: string): Promise<{ success: boolean; url: string; title: string; error?: string }>;
  getSnapshot(): Promise<PageSnapshot>;
  extractElements(selectors: Record<string, string>): Promise<Record<string, Array<{
    tag: string;
    text: string;
    href?: string;
    src?: string;
  }>>>;
}

export interface ExtensionCommand {
  type: 'NAVIGATE' | 'GET_SNAPSHOT' | 'EXTRACT_DOM' | 'TEST_API';
  requestId: string;
  params?: Record<string, unknown>;
}

export interface ExtensionResult {
  requestId: string;
  data?: unknown;
  error?: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  html: string;
  visibleText: string;
  networkCalls: Array<{
    url: string;
    method: string;
    status: number;
    responseType: string;
  }>;
  timestamp: Date;
}