/**
 * Config Fetcher Tests
 */

import { describe, it, expect } from 'vitest';
import { fetchWithConfig, fetchCompanyData } from './config-fetcher';

describe('config-fetcher', () => {
  describe('fetchWithConfig', () => {
    it('should handle invalid URLs gracefully', async () => {
      const config = {
        id: 'test',
        companyId: 'test',
        name: 'Test',
        contentType: 'job_listing',
        url: 'not-a-valid-url',
        method: 'GET' as const,
        headers: {},
        params: {},
        parseWith: 'json' as const,
        authRequired: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await fetchWithConfig(config);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('fetchCompanyData', () => {
    it('should return empty results for empty config array', async () => {
      const configs: any[] = [];
      const results = await fetchCompanyData(configs);

      expect(Object.keys(results)).toHaveLength(0);
    });
  });
});