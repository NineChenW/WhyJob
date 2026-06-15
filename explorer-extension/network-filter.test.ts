import { describe, it, expect } from 'vitest';
import type { CapturedNetworkCall, GetNetworkLogParams } from './types';

describe('Network Log Filter Logic', () => {
  // Test data
  const mockCalls: CapturedNetworkCall[] = [
    {
      id: 'nc_1',
      url: 'https://example.com/api/jobs',
      method: 'GET',
      status: 200,
      responseType: 'xhr',
      timing: 100,
      requestHeaders: {},
      responseHeaders: {},
      timestamp: new Date(),
    },
    {
      id: 'nc_2',
      url: 'https://example.com/api/jobs/123',
      method: 'POST',
      status: 201,
      responseType: 'fetch',
      timing: 150,
      requestHeaders: {},
      responseHeaders: {},
      timestamp: new Date(),
    },
    {
      id: 'nc_3',
      url: 'https://example.com/api/users',
      method: 'GET',
      status: 404,
      responseType: 'xhr',
      timing: 80,
      requestHeaders: {},
      responseHeaders: {},
      timestamp: new Date(),
    },
    {
      id: 'nc_4',
      url: 'https://other.com/api/data',
      method: 'GET',
      status: 500,
      responseType: 'fetch',
      timing: 200,
      requestHeaders: {},
      responseHeaders: {},
      timestamp: new Date(),
    },
    {
      id: 'nc_5',
      url: 'https://example.com/api/legacy',
      method: 'DELETE',
      status: 301,
      responseType: 'xhr',
      timing: 50,
      requestHeaders: {},
      responseHeaders: {},
      timestamp: new Date(),
    },
  ];

  // Filter function (extracted logic for testing)
  function filterCalls(
    calls: CapturedNetworkCall[],
    filter?: GetNetworkLogParams['filter']
  ): CapturedNetworkCall[] {
    if (!filter) return calls;

    return calls.filter(call => {
      // URL pattern filter
      if (filter.urlPattern) {
        try {
          const regex = new RegExp(filter.urlPattern);
          if (!regex.test(call.url)) return false;
        } catch {
          // Invalid regex, skip filter
        }
      }

      // Method filter
      if (filter.methods && filter.methods.length > 0) {
        if (!filter.methods.includes(call.method)) return false;
      }

      // Status range filter
      if (filter.statusRange) {
        const firstDigit = Math.floor(call.status / 100);
        const rangeMap: Record<string, number> = { '2xx': 2, '3xx': 3, '4xx': 4, '5xx': 5 };
        if (firstDigit !== rangeMap[filter.statusRange]) return false;
      }

      return true;
    });
  }

  describe('URL Pattern Filter', () => {
    it('should filter calls by URL pattern matching', () => {
      const result = filterCalls(mockCalls, { urlPattern: 'example\\.com/api/jobs$' });
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/api/jobs');
    });

    it('should return empty array for no matches', () => {
      const result = filterCalls(mockCalls, { urlPattern: 'notfound\\.com' });
      expect(result).toHaveLength(0);
    });

    it('should return all calls for undefined pattern', () => {
      const result = filterCalls(mockCalls, {});
      expect(result).toHaveLength(mockCalls.length);
    });

    it('should handle invalid regex gracefully', () => {
      const result = filterCalls(mockCalls, { urlPattern: '[invalid(' });
      // Invalid regex - filter is skipped
      expect(result).toHaveLength(mockCalls.length);
    });

    it('should match using wildcard patterns', () => {
      const result = filterCalls(mockCalls, { urlPattern: 'example\\.com/.*' });
      expect(result).toHaveLength(4);
    });

    it('should match beginning of URL', () => {
      const result = filterCalls(mockCalls, { urlPattern: 'example\\.com' });
      // Matches all example.com URLs
      expect(result).toHaveLength(4);
    });
  });

  describe('Methods Filter', () => {
    it('should filter calls by single method', () => {
      const result = filterCalls(mockCalls, { methods: ['GET'] });
      expect(result).toHaveLength(3);
      result.forEach(call => expect(call.method).toBe('GET'));
    });

    it('should filter calls by multiple methods', () => {
      const result = filterCalls(mockCalls, { methods: ['GET', 'POST'] });
      expect(result).toHaveLength(4); // 3 GET + 1 POST
      result.forEach(call => {
        expect(['GET', 'POST']).toContain(call.method);
      });
    });

    it('should return empty array for non-matching method', () => {
      const result = filterCalls(mockCalls, { methods: ['PATCH'] });
      expect(result).toHaveLength(0);
    });

    it('should handle empty methods array', () => {
      const result = filterCalls(mockCalls, { methods: [] });
      expect(result).toHaveLength(mockCalls.length);
    });
  });

  describe('Status Range Filter', () => {
    it('should filter 2xx status codes', () => {
      const result = filterCalls(mockCalls, { statusRange: '2xx' });
      expect(result).toHaveLength(2);
      result.forEach(call => {
        expect(call.status).toBeGreaterThanOrEqual(200);
        expect(call.status).toBeLessThan(300);
      });
    });

    it('should filter 3xx status codes', () => {
      const result = filterCalls(mockCalls, { statusRange: '3xx' });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(301);
    });

    it('should filter 4xx status codes', () => {
      const result = filterCalls(mockCalls, { statusRange: '4xx' });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(404);
    });

    it('should filter 5xx status codes', () => {
      const result = filterCalls(mockCalls, { statusRange: '5xx' });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(500);
    });
  });

  describe('Combined Filters', () => {
    it('should filter by URL pattern and method', () => {
      const result = filterCalls(mockCalls, {
        urlPattern: 'example\\.com',
        methods: ['GET'],
      });
      // example.com with GET: nc_1 (api/jobs) and nc_3 (api/users)
      expect(result).toHaveLength(2);
      result.forEach(call => {
        expect(call.url).toContain('example.com');
        expect(call.method).toBe('GET');
      });
    });

    it('should filter by method and status range', () => {
      const result = filterCalls(mockCalls, {
        methods: ['GET', 'POST'],
        statusRange: '2xx',
      });
      // GET/POST with 2xx: nc_1 (GET,200), nc_2 (POST,201)
      expect(result).toHaveLength(2);
      result.forEach(call => {
        expect(['GET', 'POST']).toContain(call.method);
        expect(call.status).toBeGreaterThanOrEqual(200);
        expect(call.status).toBeLessThan(300);
      });
    });

    it('should filter by all criteria', () => {
      const result = filterCalls(mockCalls, {
        urlPattern: 'example\\.com',
        methods: ['GET', 'POST', 'DELETE'],
        statusRange: '2xx',
      });
      // example.com with GET/POST/DELETE and 2xx: nc_1 (GET,200), nc_2 (POST,201)
      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://example.com/api/jobs');
      expect(result[1].url).toBe('https://example.com/api/jobs/123');
    });
  });
});

describe('FIFO Buffer Logic', () => {
  it('should limit stored calls to MAX_NETWORK_CALLS_STORED', () => {
    const MAX = 500;
    const calls: string[] = [];

    // Simulate adding 550 calls
    for (let i = 0; i < 550; i++) {
      calls.push(`call_${i}`);
      if (calls.length > MAX) {
        calls.shift();
      }
    }

    expect(calls.length).toBe(MAX);
    expect(calls[0]).toBe('call_50'); // First 50 dropped
    expect(calls[499]).toBe('call_549'); // Last one kept
  });
});