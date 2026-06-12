import { describe, it, expect, beforeEach } from 'vitest';
import {
  addCommand,
  addCommands,
  getCommands,
  peekCommands,
  addResult,
  addResults,
  getResults,
  peekResults,
  clearCommands,
  clearResults,
  clearAll,
  getQueueStats,
} from './relay';
import type { Command, CommandResult } from '@/schemas/explorer';

describe('HTTP Relay - Command Queue', () => {
  const extensionId = 'test-extension-1';

  beforeEach(() => {
    clearAll();
  });

  describe('addCommand / getCommands', () => {
    it('should add and retrieve a single command', () => {
      const command: Command = {
        type: 'NAVIGATE',
        requestId: 'req-1',
        params: { url: 'https://example.com' },
      };

      addCommand(extensionId, command);
      const commands = getCommands(extensionId);

      expect(commands).toHaveLength(1);
      expect(commands[0]).toEqual(command);
    });

    it('should consume commands on get (fire-and-forget)', () => {
      const command: Command = {
        type: 'NAVIGATE',
        requestId: 'req-1',
      };

      addCommand(extensionId, command);
      expect(getCommands(extensionId)).toHaveLength(1);
      expect(getCommands(extensionId)).toHaveLength(0);
    });

    it('should handle multiple commands for same extension', () => {
      const commands: Command[] = [
        { type: 'NAVIGATE', requestId: 'req-1', params: { url: 'https://a.com' } },
        { type: 'GET_SNAPSHOT', requestId: 'req-2' },
        { type: 'EXTRACT_DOM', requestId: 'req-3', params: { selectors: { title: 'h1' } } },
      ];

      addCommands(extensionId, commands);
      const retrieved = getCommands(extensionId);

      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].type).toBe('NAVIGATE');
      expect(retrieved[1].type).toBe('GET_SNAPSHOT');
      expect(retrieved[2].type).toBe('EXTRACT_DOM');
    });

    it('should separate queues by extension ID', () => {
      const command1: Command = { type: 'NAVIGATE', requestId: 'req-1' };
      const command2: Command = { type: 'GET_SNAPSHOT', requestId: 'req-2' };

      addCommand('ext-1', command1);
      addCommand('ext-2', command2);

      expect(getCommands('ext-1')).toHaveLength(1);
      expect(getCommands('ext-2')).toHaveLength(1);
      expect(getCommands('ext-1')).toHaveLength(0);
    });
  });

  describe('peekCommands', () => {
    it('should return commands without consuming them', () => {
      const command: Command = { type: 'NAVIGATE', requestId: 'req-1' };
      addCommand(extensionId, command);

      expect(peekCommands(extensionId)).toHaveLength(1);
      expect(peekCommands(extensionId)).toHaveLength(1);
    });

    it('should return empty array for unknown extension', () => {
      expect(peekCommands('unknown')).toHaveLength(0);
    });
  });

  describe('clearCommands', () => {
    it('should clear all commands for an extension', () => {
      addCommand(extensionId, { type: 'NAVIGATE', requestId: 'req-1' });
      addCommand(extensionId, { type: 'GET_SNAPSHOT', requestId: 'req-2' });

      clearCommands(extensionId);
      expect(getCommands(extensionId)).toHaveLength(0);
    });
  });
});

describe('HTTP Relay - Result Store', () => {
  const extensionId = 'test-extension-1';

  beforeEach(() => {
    clearAll();
  });

  describe('addResult / getResults', () => {
    it('should add and retrieve a single result', () => {
      const result: CommandResult = {
        requestId: 'req-1',
        success: true,
        data: { title: 'Test Page' },
      };

      addResult(extensionId, result);
      const results = getResults(extensionId);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(result);
    });

    it('should consume results on get', () => {
      const result: CommandResult = { requestId: 'req-1', success: true };
      addResult(extensionId, result);

      expect(getResults(extensionId)).toHaveLength(1);
      expect(getResults(extensionId)).toHaveLength(0);
    });

    it('should handle failed results', () => {
      const result: CommandResult = {
        requestId: 'req-1',
        success: false,
        error: 'Navigation failed: timeout',
      };

      addResult(extensionId, result);
      const results = getResults(extensionId);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Navigation failed: timeout');
    });

    it('should handle multiple results', () => {
      const results: CommandResult[] = [
        { requestId: 'req-1', success: true },
        { requestId: 'req-2', success: true },
        { requestId: 'req-3', success: false, error: 'Error' },
      ];

      addResults(extensionId, results);
      const retrieved = getResults(extensionId);

      expect(retrieved).toHaveLength(3);
      expect(retrieved.filter((r) => r.success)).toHaveLength(2);
      expect(retrieved.filter((r) => !r.success)).toHaveLength(1);
    });
  });

  describe('peekResults', () => {
    it('should return results without consuming them', () => {
      const result: CommandResult = { requestId: 'req-1', success: true };
      addResult(extensionId, result);

      expect(peekResults(extensionId)).toHaveLength(1);
      expect(peekResults(extensionId)).toHaveLength(1);
    });
  });

  describe('clearResults', () => {
    it('should clear all results for an extension', () => {
      addResult(extensionId, { requestId: 'req-1', success: true });
      addResult(extensionId, { requestId: 'req-2', success: true });

      clearResults(extensionId);
      expect(getResults(extensionId)).toHaveLength(0);
    });
  });
});

describe('HTTP Relay - Utility Functions', () => {
  beforeEach(() => {
    clearAll();
  });

  describe('clearAll', () => {
    it('should clear all queues and stores', () => {
      addCommand('ext-1', { type: 'NAVIGATE', requestId: 'req-1' });
      addCommand('ext-2', { type: 'GET_SNAPSHOT', requestId: 'req-2' });
      addResult('ext-1', { requestId: 'req-1', success: true });
      addResult('ext-3', { requestId: 'req-3', success: true });

      clearAll();

      expect(getCommands('ext-1')).toHaveLength(0);
      expect(getCommands('ext-2')).toHaveLength(0);
      expect(getResults('ext-1')).toHaveLength(0);
      expect(getResults('ext-3')).toHaveLength(0);
    });
  });

  describe('getQueueStats', () => {
    it('should return correct stats for empty queues', () => {
      const stats = getQueueStats();

      expect(stats.commandQueueSize).toBe(0);
      expect(stats.resultStoreSize).toBe(0);
      expect(stats.extensionIds).toHaveLength(0);
    });

    it('should return correct stats after adding items', () => {
      addCommand('ext-1', { type: 'NAVIGATE', requestId: 'req-1' });
      addCommand('ext-1', { type: 'GET_SNAPSHOT', requestId: 'req-2' });
      addCommand('ext-2', { type: 'EXTRACT_DOM', requestId: 'req-3' });
      addResult('ext-1', { requestId: 'req-1', success: true });
      addResult('ext-3', { requestId: 'req-2', success: true });

      const stats = getQueueStats();

      expect(stats.commandQueueSize).toBe(3);
      expect(stats.resultStoreSize).toBe(2);
      expect(stats.extensionIds).toContain('ext-1');
      expect(stats.extensionIds).toContain('ext-2');
      expect(stats.extensionIds).toContain('ext-3');
    });

    it('should not count consumed items', () => {
      addCommand('ext-1', { type: 'NAVIGATE', requestId: 'req-1' });
      getCommands('ext-1');

      const stats = getQueueStats();
      expect(stats.commandQueueSize).toBe(0);
    });
  });
});