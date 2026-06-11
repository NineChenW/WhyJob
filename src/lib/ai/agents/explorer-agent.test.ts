/**
 * Unit tests for Explorer Agent utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  cleanUrl,
  suggestCareersUrl,
  inferSelectors,
  pickBestUrl,
  inferParseMethod,
  calculateConfidence,
  type Discovery,
} from './explorer-agent';

describe('cleanUrl', () => {
  it('should return clean URL without query params', () => {
    expect(cleanUrl('https://example.com/path?query=value')).toBe('https://example.com/path');
  });

  it('should return clean URL without trailing slash', () => {
    expect(cleanUrl('https://example.com/path/')).toBe('https://example.com/path');
  });

  it('should return original URL for invalid URLs', () => {
    expect(cleanUrl('not-a-url')).toBe('not-a-url');
  });

  it('should handle URLs with only protocol and host', () => {
    expect(cleanUrl('https://example.com')).toBe('https://example.com');
  });
});

describe('suggestCareersUrl', () => {
  it('should suggest /careers path', () => {
    expect(suggestCareersUrl('https://example.com')).toBe('https://example.com/careers');
  });

  it('should preserve base URL path', () => {
    expect(suggestCareersUrl('https://example.com/company')).toBe('https://example.com/company/careers');
  });

  it('should handle URLs without trailing slash', () => {
    expect(suggestCareersUrl('https://example.com')).toBe('https://example.com/careers');
  });
});

describe('inferSelectors', () => {
  it('should return job selectors for jobs content type', () => {
    const selectors = inferSelectors('jobs');
    expect(selectors).toHaveProperty('title');
    expect(selectors).toHaveProperty('link');
  });

  it('should return job selectors for careers content type', () => {
    const selectors = inferSelectors('careers');
    expect(selectors).toHaveProperty('title');
    expect(selectors).toHaveProperty('link');
  });

  it('should return culture selectors for culture content type', () => {
    const selectors = inferSelectors('culture');
    expect(selectors).toHaveProperty('content');
    expect(selectors).toHaveProperty('values');
  });

  it('should return default selectors for unknown content type', () => {
    const selectors = inferSelectors('unknown');
    expect(selectors).toHaveProperty('title');
    expect(selectors).toHaveProperty('content');
  });
});

describe('pickBestUrl', () => {
  it('should prefer API endpoint over webpage', () => {
    const discoveries: Discovery[] = [
      { type: 'webpage', url: 'https://example.com/page' },
      { type: 'api_endpoint', url: 'https://example.com/api/jobs' },
    ];
    expect(pickBestUrl(discoveries)).toBe('https://example.com/api/jobs');
  });

  it('should return webpage URL if no API endpoint', () => {
    const discoveries: Discovery[] = [
      { type: 'webpage', url: 'https://example.com/page' },
    ];
    expect(pickBestUrl(discoveries)).toBe('https://example.com/page');
  });

  it('should return null for empty discoveries', () => {
    expect(pickBestUrl([])).toBeNull();
  });

  it('should skip discoveries without URLs', () => {
    const discoveries: Discovery[] = [
      { type: 'webpage' }, // no URL
      { type: 'api_endpoint', url: 'https://example.com/api' },
    ];
    expect(pickBestUrl(discoveries)).toBe('https://example.com/api');
  });
});

describe('inferParseMethod', () => {
  it('should return json for API endpoint discoveries', () => {
    const discoveries: Discovery[] = [
      { type: 'api_endpoint', url: 'https://example.com/api' },
    ];
    expect(inferParseMethod(discoveries)).toBe('json');
  });

  it('should return cheerio for webpage discoveries', () => {
    const discoveries: Discovery[] = [
      { type: 'webpage', url: 'https://example.com/page' },
    ];
    expect(inferParseMethod(discoveries)).toBe('cheerio');
  });

  it('should return cheerio for requires_auth discoveries', () => {
    const discoveries: Discovery[] = [
      { type: 'requires_auth', url: 'https://example.com/login' },
    ];
    expect(inferParseMethod(discoveries)).toBe('cheerio');
  });

  it('should prefer api_endpoint when mixed', () => {
    const discoveries: Discovery[] = [
      { type: 'webpage', url: 'https://example.com/page' },
      { type: 'api_endpoint', url: 'https://example.com/api' },
      { type: 'requires_auth' },
    ];
    expect(inferParseMethod(discoveries)).toBe('json');
  });
});

describe('calculateConfidence', () => {
  it('should return 0 for empty discoveries', () => {
    expect(calculateConfidence([])).toBe(0);
  });

  it('should start at base confidence of 50', () => {
    const discoveries: Discovery[] = [
      { type: 'webpage', url: 'https://example.com' },
    ];
    expect(calculateConfidence(discoveries)).toBe(50);
  });

  it('should add 30 for API endpoint', () => {
    const discoveries: Discovery[] = [
      { type: 'api_endpoint', url: 'https://example.com/api' },
    ];
    expect(calculateConfidence(discoveries)).toBe(80); // 50 + 30
  });

  it('should add 20 for webpage with selectors', () => {
    const discoveries: Discovery[] = [
      { type: 'webpage', url: 'https://example.com', selectors: { title: 'h1' } },
    ];
    expect(calculateConfidence(discoveries)).toBe(70); // 50 + 20
  });

  it('should subtract 20 for requires_auth', () => {
    const discoveries: Discovery[] = [
      { type: 'requires_auth', url: 'https://example.com/login' },
    ];
    expect(calculateConfidence(discoveries)).toBe(30); // 50 - 20
  });

  it('should subtract 10 for no_content', () => {
    const discoveries: Discovery[] = [
      { type: 'no_content', reason: 'test' },
    ];
    expect(calculateConfidence(discoveries)).toBe(40); // 50 - 10
  });

  it('should cap at 100 maximum', () => {
    const discoveries: Discovery[] = [
      { type: 'api_endpoint', url: 'https://example.com/api' },
      { type: 'webpage', url: 'https://example.com', selectors: { title: 'h1' } },
    ];
    expect(calculateConfidence(discoveries)).toBe(100); // 50 + 30 + 20
  });

  it('should floor at 0 minimum', () => {
    const discoveries: Discovery[] = [
      { type: 'no_content', reason: 'test' },
      { type: 'requires_auth' },
    ];
    expect(calculateConfidence(discoveries)).toBe(20); // 50 - 10 - 20
  });
});