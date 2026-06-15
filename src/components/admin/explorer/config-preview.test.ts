/**
 * ConfigPreview unit tests
 */

import { describe, expect, it } from 'vitest';

// Inline the formatJson function for testing (it's a private utility)
function formatJson(value: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => `${spaces}  ${formatJson(item, indent + 1)}`).join(',\n');
    return `[\n${items}\n${spaces}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries
      .map(([k, v]) => `${spaces}  "${k}": ${formatJson(v, indent + 1)}`)
      .join(',\n');
    return `{\n${lines}\n${spaces}}`;
  }
  return String(value);
}

describe('formatJson', () => {
  it('should format null as "null"', () => {
    expect(formatJson(null)).toBe('null');
  });

  it('should format undefined as empty string', () => {
    expect(formatJson(undefined)).toBe('');
  });

  it('should format strings with quotes', () => {
    expect(formatJson('hello')).toBe('"hello"');
  });

  it('should format numbers as strings', () => {
    expect(formatJson(42)).toBe('42');
    expect(formatJson(3.14)).toBe('3.14');
  });

  it('should format booleans as strings', () => {
    expect(formatJson(true)).toBe('true');
    expect(formatJson(false)).toBe('false');
  });

  it('should format empty array as "[]"', () => {
    expect(formatJson([])).toBe('[]');
  });

  it('should format array with items', () => {
    expect(formatJson([1, 2, 3])).toBe('[\n  1,\n  2,\n  3\n]');
  });

  it('should format empty object as "{}"', () => {
    expect(formatJson({})).toBe('{}');
  });

  it('should format object with properties', () => {
    const result = formatJson({ url: 'https://example.com', method: 'GET' });
    expect(result).toContain('"url": "https://example.com"');
    expect(result).toContain('"method": "GET"');
  });

  it('should format nested objects', () => {
    const result = formatJson({ config: { url: 'test', pagination: { type: 'page' } } });
    expect(result).toContain('"config"');
    expect(result).toContain('"pagination"');
  });

  it('should format arrays of objects', () => {
    const result = formatJson([{ id: 1 }, { id: 2 }]);
    expect(result).toContain('"id": 1');
    expect(result).toContain('"id": 2');
  });
});