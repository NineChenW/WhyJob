import { describe, it, expect } from 'vitest';
import {
  MAX_VISIBLE_TEXT_LENGTH,
  MAX_ELEMENT_TEXT_LENGTH,
  NAVIGATION_TIMEOUT_MS,
  JS_EXECUTION_TIMEOUT_MS,
  MAX_NETWORK_CALLS_STORED,
  DEFAULT_CONFIG,
} from './types';

describe('Explorer Extension Types', () => {
  describe('Constants', () => {
    it('should have correct max visible text length', () => {
      expect(MAX_VISIBLE_TEXT_LENGTH).toBe(5000);
    });

    it('should have correct max element text length', () => {
      expect(MAX_ELEMENT_TEXT_LENGTH).toBe(200);
    });

    it('should have correct navigation timeout', () => {
      expect(NAVIGATION_TIMEOUT_MS).toBe(10000);
    });

    it('should have correct JS execution timeout', () => {
      expect(JS_EXECUTION_TIMEOUT_MS).toBe(5000);
    });

    it('should have correct max network calls stored', () => {
      expect(MAX_NETWORK_CALLS_STORED).toBe(500);
    });
  });

  describe('Default Config', () => {
    it('should have default server URL', () => {
      expect(DEFAULT_CONFIG.serverUrl).toBe('http://localhost:3000/api/agent');
    });

    it('should have default poll interval', () => {
      expect(DEFAULT_CONFIG.pollIntervalMs).toBe(2000);
    });

    it('should have default connection timeout', () => {
      expect(DEFAULT_CONFIG.connectionTimeoutMs).toBe(10000);
    });
  });
});

describe('Extension Command Types', () => {
  it('should define valid command types for Iteration 1', () => {
    const validTypes = ['NAVIGATE', 'GET_SNAPSHOT', 'EXTRACT_DOM'] as const;
    validTypes.forEach(type => {
      expect(['NAVIGATE', 'GET_SNAPSHOT', 'EXTRACT_DOM']).toContain(type);
    });
  });

  it('should define valid command types for Iteration 2', () => {
    const validTypes = ['EXECUTE_JS', 'START_NETWORK_MONITORING', 'GET_NETWORK_LOG', 'STOP_NETWORK_MONITORING'] as const;
    validTypes.forEach(type => {
      expect(['EXECUTE_JS', 'START_NETWORK_MONITORING', 'GET_NETWORK_LOG', 'STOP_NETWORK_MONITORING']).toContain(type);
    });
  });
});

describe('DOM Element Extraction', () => {
  it('should truncate text to max length', () => {
    const longText = 'a'.repeat(300);
    const truncated = longText.slice(0, MAX_ELEMENT_TEXT_LENGTH);
    expect(truncated.length).toBeLessThanOrEqual(MAX_ELEMENT_TEXT_LENGTH);
  });
});

describe('Network Monitoring Types', () => {
  it('should have valid CapturedNetworkCall structure', () => {
    const call = {
      id: 'nc_test_123',
      url: 'https://example.com/api/jobs',
      method: 'GET',
      status: 200,
      responseType: 'xhr' as const,
      timing: 150,
      requestHeaders: { 'Content-Type': 'application/json' },
      responseHeaders: { 'Content-Type': 'application/json' },
      timestamp: new Date(),
    };

    expect(call.id).toBeDefined();
    expect(call.url).toContain('https://example.com');
    expect(['GET', 'POST', 'PUT', 'DELETE']).toContain(call.method);
    expect(call.status).toBeGreaterThanOrEqual(0);
    expect(['xhr', 'fetch', 'document', 'other']).toContain(call.responseType);
  });

  it('should have valid ExecuteJsResult structure', () => {
    const result = {
      success: true,
      output: 'Clicked button',
      duration: 50,
    };

    expect(typeof result.success).toBe('boolean');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should have valid StartNetworkMonitoringResult structure', () => {
    const result = {
      success: true,
      monitoringId: 'monitor_abc123',
      message: 'Network monitoring started',
    };

    expect(typeof result.success).toBe('boolean');
    expect(result.monitoringId).toBeDefined();
    expect(result.message).toBeDefined();
  });

  it('should have valid GetNetworkLogResult structure', () => {
    const result = {
      calls: [],
      count: 0,
      hasMore: false,
    };

    expect(Array.isArray(result.calls)).toBe(true);
    expect(typeof result.count).toBe('number');
    expect(typeof result.hasMore).toBe('boolean');
  });

  it('should have valid StopNetworkMonitoringResult structure', () => {
    const result = {
      success: true,
      totalCallsCaptured: 42,
      duration: 5000,
    };

    expect(typeof result.success).toBe('boolean');
    expect(result.totalCallsCaptured).toBeGreaterThanOrEqual(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});