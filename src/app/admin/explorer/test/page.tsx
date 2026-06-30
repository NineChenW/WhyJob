/**
 * Explorer Agent Test Page
 *
 * Manual testing interface for the Chrome Extension protocol.
 * Tests command polling and result posting via /api/agent/commands and /api/agent/results
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CommandType, PollResponse, Command } from '@/lib/http/explorer-types';

interface QueueStats {
  dequeuedCommands: number;
  processedResults: number;
  commandsByTask: Record<string, number>;
}

interface LogEntry {
  id: string;
  type: 'poll' | 'result' | 'add_command';
  timestamp: Date;
  endpoint: string;
  payload: unknown;
  status?: 'success' | 'already_processed' | 'error';
  response?: unknown;
}

// Available command types matching explorer-extension
const COMMAND_TYPES: { value: CommandType; label: string; params: string[] }[] = [
  { value: 'NAVIGATE', label: 'NAVIGATE', params: ['url'] },
  { value: 'GET_SNAPSHOT', label: 'GET_SNAPSHOT', params: [] },
  { value: 'EXTRACT_DOM', label: 'EXTRACT_DOM', params: ['selectors'] },
  { value: 'EXECUTE_JS', label: 'EXECUTE_JS', params: ['script'] },
  { value: 'START_NETWORK_MONITORING', label: 'START_NETWORK_MONITORING', params: ['filter'] },
  { value: 'GET_NETWORK_LOG', label: 'GET_NETWORK_LOG', params: ['monitoringId'] },
  { value: 'STOP_NETWORK_MONITORING', label: 'STOP_NETWORK_MONITORING', params: ['monitoringId'] },
];

export default function ExplorerTestPage() {
  const [taskId, setTaskId] = useState('test-task-001');

  // Command state
  const [selectedAction, setSelectedAction] = useState<CommandType>('NAVIGATE');
  const [params, setParams] = useState<Record<string, string>>({});

  // Response state for simulating extension results
  const [responseSuccess, setResponseSuccess] = useState(true);
  const [responseData, setResponseData] = useState('');
  const [responseError, setResponseError] = useState('');

  // Current command (from last poll)
  const [currentCommand, setCurrentCommand] = useState<{
    requestId: string;
    type: CommandType;
    params?: Record<string, unknown>;
  } | null>(null);

  // Poll response state
  const [pollResponse, setPollResponse] = useState<PollResponse | null>(null);

  // Queue stats
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);

  // Log state
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Polling state
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchQueueStatsRef = useRef<() => Promise<void>>(async () => {
    try {
      const res = await fetch('/api/explorer/test/queue');
      const data = await res.json();
      if (data.success) {
        setQueueStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch queue stats:', error);
    }
  });

  // Fetch stats on mount
  useEffect(() => {
    fetchQueueStatsRef.current();
  }, []);

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs(prev => [{
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    }, ...prev]);
  }, []);

  const handleActionChange = (value: string | null) => {
    if (value) setSelectedAction(value as CommandType);
  };

  const handleSuccessChange = (value: string | null) => {
    if (value) setResponseSuccess(value === 'true');
  };

  // Add a command to the task's queue (for testing)
  const handleAddCommand = async () => {
    const actionConfig = COMMAND_TYPES.find(a => a.value === selectedAction);
    const parsedParams: Record<string, unknown> = {};

    if (actionConfig) {
      for (const param of actionConfig.params) {
        if (params[param]) {
          try {
            parsedParams[param] = JSON.parse(params[param]);
          } catch {
            parsedParams[param] = params[param];
          }
        }
      }
    }

    const payload = {
      taskId,
      type: selectedAction,
      params: parsedParams,
    };

    addLog({
      type: 'add_command',
      endpoint: 'POST /api/explorer/test/queue',
      payload,
      status: 'success',
    });

    try {
      const res = await fetch('/api/explorer/test/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      addLog({
        type: 'add_command',
        endpoint: 'POST /api/explorer/test/queue',
        payload: data,
        status: data.success ? 'success' : 'error',
        response: data,
      });

      // Refresh queue stats
      fetchQueueStatsRef.current();

      // Clear params
      setParams({});
    } catch (error) {
      addLog({
        type: 'add_command',
        endpoint: 'POST /api/explorer/test/queue',
        payload: { error: String(error) },
        status: 'error',
      });
    }
  };

  // Poll for commands (simulating extension behavior)
  const handlePoll = async () => {
    const pollUrl = `/api/agent/commands?taskId=${encodeURIComponent(taskId)}`;

    try {
      const res = await fetch(pollUrl);
      const data: PollResponse = await res.json();

      addLog({
        type: 'poll',
        endpoint: pollUrl,
        payload: { taskId },
        status: res.ok ? 'success' : 'error',
        response: data,
      });

      setPollResponse(data);

      if (data.commands && data.commands.length > 0) {
        setCurrentCommand({
          requestId: data.commands[0].requestId,
          type: data.commands[0].type,
          params: data.commands[0].params as Record<string, unknown> | undefined,
        });
      } else {
        setCurrentCommand(null);
      }

      // Refresh queue stats
      fetchQueueStatsRef.current();

      return data;
    } catch (error) {
      addLog({
        type: 'poll',
        endpoint: pollUrl,
        payload: { taskId },
        status: 'error',
        response: { error: String(error) },
      });
      return null;
    }
  };

  // Post result (simulating extension reporting command execution)
  const handlePostResult = async () => {
    if (!currentCommand) {
      addLog({
        type: 'result',
        endpoint: 'POST /api/agent/results',
        payload: { error: 'No command to post result for' },
        status: 'error',
      });
      return;
    }

    let parsedData: unknown = undefined;
    if (responseData) {
      try {
        parsedData = JSON.parse(responseData);
      } catch {
        parsedData = responseData;
      }
    }

    const resultPayload = {
      taskId,
      results: [{
        requestId: currentCommand.requestId,
        success: responseSuccess,
        data: parsedData as Command['params'] extends object ? Command['params'] : unknown,
        error: responseError || undefined,
      }],
    };

    addLog({
      type: 'result',
      endpoint: 'POST /api/agent/results',
      payload: resultPayload,
      status: 'success',
    });

    try {
      const res = await fetch('/api/agent/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultPayload),
      });

      const data = await res.json();

      addLog({
        type: 'result',
        endpoint: 'POST /api/agent/results',
        payload: data,
        status: data.success ? (data.results?.[0]?.alreadyProcessed ? 'already_processed' : 'success') : 'error',
        response: data,
      });

      // If result was processed (not duplicate), clear current command
      if (data.success && !data.results?.[0]?.alreadyProcessed) {
        setCurrentCommand(null);
      }

      // Refresh queue stats
      fetchQueueStatsRef.current();

      // Clear inputs
      setResponseData('');
      setResponseError('');
    } catch (error) {
      addLog({
        type: 'result',
        endpoint: 'POST /api/agent/results',
        payload: { error: String(error) },
        status: 'error',
      });
    }
  };

  // Start/stop polling
  const startPolling = () => {
    if (isPolling) return;
    setIsPolling(true);
    pollingIntervalRef.current = setInterval(() => {
      handlePoll();
    }, 2000);
  };

  const stopPolling = () => {
    setIsPolling(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Auto-poll effect
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const clearLogs = () => setLogs([]);
  const clearCurrentCommand = () => setCurrentCommand(null);

  const getActionParams = (actionValue: CommandType) => {
    const action = COMMAND_TYPES.find(a => a.value === actionValue);
    return action?.params || [];
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Explorer Extension Protocol Test</h1>
        <p className="text-muted-foreground">
          Test command polling (GET /api/agent/commands) and result posting (POST /api/agent/results)
        </p>
      </div>

      {/* Config Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task ID</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className="font-mono text-xs h-8"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Server</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-xs">http://localhost:3000</code>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Queue Stats</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Commands Dequeued:</span>
              <Badge variant="outline">{queueStats?.dequeuedCommands ?? 0}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Results Processed:</span>
              <Badge variant="outline">{queueStats?.processedResults ?? 0}</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={() => fetchQueueStatsRef.current()}>
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Poll Response Card */}
      {pollResponse && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Poll Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Commands:</span>
                <Badge variant="outline" className="ml-2">{pollResponse.commands?.length ?? 0}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Task Status:</span>
                <Badge variant="outline" className="ml-2">{pollResponse.taskStatus ?? 'N/A'}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Server URL:</span>
                <code className="ml-2 text-[10px]">{pollResponse.serverUrl}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Task ID:</span>
                <code className="ml-2 text-[10px]">{pollResponse.taskId ?? 'N/A'}</code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Command Card */}
      {currentCommand && (
        <Card className="mb-6 border-green-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-green-600">Current Command (ready for result)</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearCurrentCommand}>Clear</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Request ID:</span>
                <code className="ml-2 break-all">{currentCommand.requestId}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <Badge variant="outline" className="ml-2">{currentCommand.type}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Params:</span>
                <code className="ml-2 text-[10px]">{JSON.stringify(currentCommand.params)}</code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Command Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Add Command</CardTitle>
            <CardDescription>
              Add command to task queue (for testing)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Command Type</Label>
              <Select value={selectedAction} onValueChange={handleActionChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMAND_TYPES.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Params */}
            {getActionParams(selectedAction).map((param) => (
              <div key={param} className="space-y-2">
                <Label htmlFor={`param-${param}`}>
                  {param}
                  <span className="text-muted-foreground ml-1">(JSON for objects)</span>
                </Label>
                <Input
                  id={`param-${param}`}
                  value={params[param] || ''}
                  onChange={(e) => setParams({ ...params, [param]: e.target.value })}
                  placeholder={param === 'url' ? 'https://example.com' : ''}
                />
              </div>
            ))}

            <Button onClick={handleAddCommand} className="w-full">
              Add to Queue
            </Button>
          </CardContent>
        </Card>

        {/* Poll Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Poll for Commands</CardTitle>
            <CardDescription>
              Simulates extension polling GET /api/agent/commands
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Poll URL:</p>
              <code className="text-xs block bg-muted p-2 rounded break-all">
                /api/agent/commands?taskId=...
              </code>
            </div>

            <div className="flex gap-2">
              <Button onClick={handlePoll} className="flex-1">
                Poll Once
              </Button>
              {!isPolling ? (
                <Button onClick={startPolling} variant="outline">
                  Start Auto-Poll
                </Button>
              ) : (
                <Button onClick={stopPolling} variant="destructive">
                  Stop Poll
                </Button>
              )}
            </div>

            {isPolling && (
              <p className="text-xs text-green-600 text-center">Auto-polling every 2s...</p>
            )}
          </CardContent>
        </Card>

        {/* Result Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Post Result</CardTitle>
            <CardDescription>
              Simulates extension posting to POST /api/agent/results
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Success</Label>
              <Select
                value={responseSuccess ? 'true' : 'false'}
                onValueChange={handleSuccessChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Success</SelectItem>
                  <SelectItem value="false">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="response-data">
                Response Data
                <span className="text-muted-foreground ml-1">(JSON)</span>
              </Label>
              <Textarea
                id="response-data"
                value={responseData}
                onChange={(e) => setResponseData(e.target.value)}
                placeholder='{"url": "https://example.com", "title": "Example"}'
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="response-error">Error Message</Label>
              <Input
                id="response-error"
                value={responseError}
                onChange={(e) => setResponseError(e.target.value)}
                placeholder="Optional error message"
                disabled={responseSuccess}
              />
            </div>

            <Button onClick={handlePostResult} className="w-full" disabled={!currentCommand}>
              Post Result
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Log Panel */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>
              Extension protocol requests and responses
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={clearLogs}>
            Clear Logs
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No activity yet. Add a command, poll, or post a result to see logs.
            </p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-4 rounded-lg border ${
                    log.type === 'poll' ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' :
                    log.type === 'result' ? 'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800' :
                    'bg-muted/50 border-muted'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.type === 'poll' ? 'default' : log.type === 'result' ? 'secondary' : 'outline'}>
                        {log.type === 'poll' ? 'POLL' : log.type === 'result' ? 'RESULT' : 'ADD'}
                      </Badge>
                      <code className="text-xs text-muted-foreground">{log.endpoint}</code>
                      <span className="text-xs text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <Badge
                      variant={
                        log.status === 'success' ? 'default' :
                        log.status === 'already_processed' ? 'secondary' :
                        'destructive'
                      }
                    >
                      {log.status === 'already_processed' ? 'duplicate' : log.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground mb-1">Request:</p>
                      <pre className="bg-background p-2 rounded border font-mono overflow-x-auto">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                    {typeof log.response !== 'undefined' && (
                      <div>
                        <p className="text-muted-foreground mb-1">Response:</p>
                        <pre className="bg-background p-2 rounded border font-mono overflow-x-auto">
                          {JSON.stringify(log.response, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}