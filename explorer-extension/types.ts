// Shared types for Explorer Agent Chrome Extension

// ============================================
// HTTP Polling Protocol Types
// ============================================

// Extension polls this endpoint to get pending commands
export interface PollResponse {
  commands: Command[];
  serverUrl: string; // Server can update the URL if needed
}

// Extension posts results to this endpoint
export interface ResultPayload {
  results: CommandResult[];
}

// Command structure sent to extension
export interface Command {
  type: 'NAVIGATE' | 'GET_SNAPSHOT' | 'EXTRACT_DOM';
  requestId: string;
  params?: NavigateParams | ExtractDomParams;
}

// Result structure from extension
export interface CommandResult {
  requestId: string;
  success: boolean;
  data?: NavigateResult | SnapshotResult | ExtractDomResult;
  error?: string;
}

// ============================================
// Command Parameter Types
// ============================================

export interface NavigateParams {
  url: string;
}

export interface ExtractDomParams {
  selectors: Record<string, string>;
}

// ============================================
// Command Result Types
// ============================================

export interface NavigateResult {
  success: boolean;
  url: string;
  title: string;
  error?: string;
}

export interface SnapshotResult {
  url: string;
  title: string;
  html: string;
  visibleText: string;
  networkCalls: NetworkCall[];
  timestamp: Date;
}

export interface NetworkCall {
  url: string;
  method: string;
  status: number;
  responseType: string;
}

export interface ExtractDomResult {
  elements: Record<string, DomElement[]>;
}

export interface DomElement {
  tag: string;
  text: string;
  href?: string;
  src?: string;
  rect?: BoundingRect;
}

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================
// Configuration
// ============================================

export interface PollingConfig {
  serverUrl: string;
  pollIntervalMs: number;
  connectionTimeoutMs: number;
}

export const DEFAULT_CONFIG: PollingConfig = {
  serverUrl: 'http://127.0.0.1:3001/api/agent', // Standalone test server
  pollIntervalMs: 2000,
  connectionTimeoutMs: 10000,
};

// Constants
export const NAVIGATION_TIMEOUT_MS = 10000;
export const NETWORK_IDLE_TIMEOUT_MS = 5000;
export const MAX_VISIBLE_TEXT_LENGTH = 5000;
export const MAX_ELEMENT_TEXT_LENGTH = 200;
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;