/**
 * Config Tester Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { testFetchConfig, validateParsedData } from './config-tester';

describe('config-tester', () => {
  describe('testFetchConfig', () => {
    it('should handle network errors gracefully', async () => {
      const config = {
        id: 'test',
        companyId: 'test',
        name: 'Test Config',
        contentType: 'job_listing',
        url: 'https://invalid-domain-that-does-not-exist-12345.com/jobs',
        method: 'GET',
        headers: {},
        params: {},
        parseWith: 'json' as const,
        authRequired: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await testFetchConfig(config, { timeout: 5000 });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('network');
      expect(result.url).toBe(config.url);
    });

    it('should handle timeout', async () => {
      const config = {
        id: 'test',
        companyId: 'test',
        name: 'Test Config',
        contentType: 'job_listing',
        url: 'https://httpbin.org/delay/10', // 10 second delay
        method: 'GET',
        headers: {},
        params: {},
        parseWith: 'json' as const,
        authRequired: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await testFetchConfig(config, { timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('timeout');
    });
  });

  describe('validateParsedData', () => {
    it('should validate JSON objects', () => {
      const data = { jobs: [{ title: 'Engineer' }] };
      const config = {
        id: 'test',
        companyId: 'test',
        name: 'Test',
        contentType: 'job_listing',
        url: 'https://example.com/jobs',
        method: 'GET',
        headers: {},
        params: {},
        parseWith: 'json' as const,
        selectors: { title: 'h1' },
        authRequired: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validateParsedData(data, config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object data for JSON parseWith', () => {
      const data = 'just a string';
      const config = {
        id: 'test',
        companyId: 'test',
        name: 'Test',
        contentType: 'job_listing',
        url: 'https://example.com/jobs',
        method: 'GET',
        headers: {},
        params: {},
        parseWith: 'json' as const,
        selectors: null,
        authRequired: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validateParsedData(data, config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});