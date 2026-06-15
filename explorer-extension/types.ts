// Shared types for Explorer Agent Chrome Extension

// ============================================
// HTTP Polling Protocol Types
// ============================================

// Extension polls this endpoint to get pending commands
export interface PollResponse {
  commands: Command[];
  serverUrl: string; // Server can update the URL if needed
  taskStatus?: 'exploring' | 'complete' | 'failed';
  taskId?: string;
}

// Extension posts results to this endpoint
export interface ResultPayload {
  extensionId: string;
  taskId?: string;
  results: CommandResult[];
}

// Command structure sent to extension
export type CommandType =
  | 'NAVIGATE'
  | 'GET_SNAPSHOT'
  | 'EXTRACT_DOM'
  | 'EXECUTE_JS'
  | 'START_NETWORK_MONITORING'
  | 'GET_NETWORK_LOG'
  | 'STOP_NETWORK_MONITORING';

export interface Command {
  type: CommandType;
  requestId: string;
  params?: NavigateParams | ExtractDomParams | ExecuteJsParams | GetNetworkLogParams | StopNetworkMonitoringParams;
}

// Result structure from extension
export interface CommandResult {
  requestId: string;
  success: boolean;
  data?: NavigateResult | SnapshotResult | ExtractDomResult | ExecuteJsResult | StartNetworkMonitoringResult | GetNetworkLogResult | StopNetworkMonitoringResult;
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

export interface ExecuteJsParams {
  script: string;
  args?: Record<string, unknown>;
}

export interface GetNetworkLogParams {
  monitoringId?: string;
  filter?: {
    urlPattern?: string;
    methods?: string[];
    statusRange?: '2xx' | '3xx' | '4xx' | '5xx';
  };
}

export interface StopNetworkMonitoringParams {
  monitoringId: string;
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
  networkCalls: CapturedNetworkCall[];
  timestamp: Date;
}

export interface NetworkCall {
  url: string;
  method: string;
  status: number;
  responseType: string;
}

export interface CapturedNetworkCall {
  id: string;
  url: string;
  method: string;
  status: number;
  responseType: 'xhr' | 'fetch' | 'document' | 'other';
  timing: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  responseBody?: string;
  timestamp: Date;
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

export interface ExecuteJsResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

export interface StartNetworkMonitoringResult {
  success: boolean;
  monitoringId: string;
  message: string;
}

export interface GetNetworkLogResult {
  calls: CapturedNetworkCall[];
  count: number;
  hasMore: boolean;
}

export interface StopNetworkMonitoringResult {
  success: boolean;
  totalCallsCaptured: number;
  duration: number;
}

// ============================================
// Network Monitoring State
// ============================================

export interface NetworkCallStore {
  [monitoringId: string]: {
    calls: CapturedNetworkCall[];
    startTime: number;
  };
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
  serverUrl: 'http://localhost:3000/api/agent',
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
export const JS_EXECUTION_TIMEOUT_MS = 5000;
export const MAX_NETWORK_CALLS_STORED = 500;