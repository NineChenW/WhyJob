// Shared types for Explorer Agent Chrome Extension
// These types mirror the explorer-extension/types.ts for use in the main app

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