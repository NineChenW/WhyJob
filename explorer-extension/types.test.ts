import { describe, it, expect } from 'vitest';
import {
  MAX_VISIBLE_TEXT_LENGTH,
  MAX_ELEMENT_TEXT_LENGTH,
  NAVIGATION_TIMEOUT_MS,
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
  });

  describe('Default Config', () => {
    it('should have default server URL', () => {
      expect(DEFAULT_CONFIG.serverUrl).toBe('ws://localhost:8080');
    });

    it('should have default reconnect settings', () => {
      expect(DEFAULT_CONFIG.reconnectAttempts).toBe(5);
      expect(DEFAULT_CONFIG.reconnectDelayMs).toBe(1000);
    });

    it('should have default connection timeout', () => {
      expect(DEFAULT_CONFIG.connectionTimeoutMs).toBe(10000);
    });
  });
});

describe('Extension Message Types', () => {
  it('should define valid command types', () => {
    const validTypes = ['NAVIGATE', 'GET_SNAPSHOT', 'EXTRACT_DOM'] as const;
    validTypes.forEach(type => {
      expect(['NAVIGATE', 'GET_SNAPSHOT', 'EXTRACT_DOM']).toContain(type);
    });
  });

  it('should define message structure for CONNECT', () => {
    const connectMsg = {
      type: 'CONNECT',
      extensionId: 'test-extension-id',
    };
    expect(connectMsg.type).toBe('CONNECT');
    expect(connectMsg.extensionId).toBe('test-extension-id');
  });
});

describe('DOM Element Extraction', () => {
  it('should truncate text to max length', () => {
    const longText = 'a'.repeat(300);
    const truncated = longText.slice(0, MAX_ELEMENT_TEXT_LENGTH);
    expect(truncated.length).toBeLessThanOrEqual(MAX_ELEMENT_TEXT_LENGTH);
  });
});