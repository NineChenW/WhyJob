// src/app/explorer-test/page.tsx

/**
 * Explorer Agent Test Page
 *
 * A simple page to test the AI Explorer Agent with step-by-step display.
 * Shows the full ReAct loop execution in real-time.
 */

'use client';

import { useState } from 'react';

interface StepResult {
  step: number;
  action: string;
  reasoning: string;
  confidence: number;
  target?: Record<string, unknown>;
  observation?: string;
  discoveries?: number;
  error?: string;
}

interface Discovery {
  id: string;
  type: string;
  data?: unknown;
  confidence: number;
  timestamp: string;
}

interface FinalResult {
  success: boolean;
  taskId: string;
  status: string;
  config?: Record<string, unknown>;
  iterations: number;
  discoveries: Discovery[];
  confidence: number;
}

interface RunResponse {
  success: boolean;
  taskId: string;
  company: { id: string; name: string; website?: string; industry?: string };
  iterations: number;
  totalSteps: number;
  steps: StepResult[];
  discoveries: Discovery[];
  finalResult: FinalResult;
}

const CONTENT_TYPES = [
  { value: 'job_listing', label: 'Job Listings' },
  { value: 'company_culture', label: 'Company Culture' },
  { value: 'company_wechat', label: 'WeChat Account' },
];

export default function ExplorerTestPage() {
  const [companyName, setCompanyName] = useState('Stripe');
  const [companyWebsite, setCompanyWebsite] = useState('https://stripe.com');
  const [companyIndustry, setCompanyIndustry] = useState('FinTech');
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(['job_listing']);
  const [maxIterations, setMaxIterations] = useState(5);

  const [isRunning, setIsRunning] = useState(false);
  const [response, setResponse] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleContentTypeChange = (value: string) => {
    setSelectedContentTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const runExplorer = async () => {
    setIsRunning(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/explorer/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          companyWebsite: companyWebsite || undefined,
          companyIndustry: companyIndustry || undefined,
          contentTypes: selectedContentTypes,
          maxIterations,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to run explorer');
      }

      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Explorer Agent Test</h1>
          <p className="text-muted-foreground mt-2">
            Test the AI-powered web exploration agent with step-by-step visualization
          </p>
        </div>

        {/* Configuration Form */}
        <div className="bg-card rounded-lg border p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 bg-background border rounded-md"
                placeholder="e.g., Stripe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Website (optional)</label>
              <input
                type="text"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                className="w-full px-3 py-2 bg-background border rounded-md"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Industry (optional)</label>
              <input
                type="text"
                value={companyIndustry}
                onChange={(e) => setCompanyIndustry(e.target.value)}
                className="w-full px-3 py-2 bg-background border rounded-md"
                placeholder="e.g., FinTech"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Max Iterations</label>
              <input
                type="number"
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value) || 5)}
                min={1}
                max={20}
                className="w-full px-3 py-2 bg-background border rounded-md"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Content Types</label>
            <div className="flex gap-4">
              {CONTENT_TYPES.map((type) => (
                <label key={type.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedContentTypes.includes(type.value)}
                    onChange={() => handleContentTypeChange(type.value)}
                    className="rounded"
                  />
                  <span className="text-sm">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={runExplorer}
            disabled={isRunning || !companyName || selectedContentTypes.length === 0}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isRunning ? 'Running...' : 'Run Explorer Agent'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-destructive/10 border border-destructive rounded-lg p-4 mb-8">
            <h3 className="font-semibold text-destructive mb-1">Error</h3>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {response && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-card rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Execution Summary</h2>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    response.finalResult?.success
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-yellow-500/10 text-yellow-500'
                  }`}
                >
                  {response.finalResult?.success ? 'Success' : 'Partial'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Company</div>
                  <div className="font-medium">{response.company.name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Task ID</div>
                  <div className="font-medium text-xs">{response.taskId}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Steps</div>
                  <div className="font-medium">{response.totalSteps}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Discoveries</div>
                  <div className="font-medium">{response.discoveries.length}</div>
                </div>
              </div>

              {response.finalResult?.config && (
                <div className="mt-4 p-4 bg-background rounded-md">
                  <div className="text-sm text-muted-foreground mb-2">Generated FetchConfig</div>
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(response.finalResult.config, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Step-by-Step Timeline */}
            <div className="bg-card rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-6">ReAct Loop Execution</h2>

              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

                {/* Steps */}
                <div className="space-y-6">
                  {response.steps.map((step, index) => (
                    <div key={step.step} className="relative pl-14">
                      {/* Step number circle */}
                      <div
                        className={`absolute left-4 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          step.action === 'GENERATE_CONFIG'
                            ? 'bg-green-500 text-white'
                            : step.action === 'FAIL'
                            ? 'bg-red-500 text-white'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        {step.step}
                      </div>

                      {/* Step card */}
                      <div className="bg-background rounded-lg border p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-mono ${
                                step.action === 'NAVIGATE'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : step.action === 'GET_SNAPSHOT' || step.action === 'GET_NETWORK_LOG'
                                  ? 'bg-purple-500/10 text-purple-500'
                                  : step.action === 'EXECUTE_JS'
                                  ? 'bg-orange-500/10 text-orange-500'
                                  : step.action === 'GENERATE_CONFIG'
                                  ? 'bg-green-500/10 text-green-500'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {step.action}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              confidence: {step.confidence}%
                            </span>
                          </div>
                          {step.discoveries !== undefined && (
                            <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded">
                              {step.discoveries} discoveries
                            </span>
                          )}
                        </div>

                        {/* Reasoning */}
                        <p className="text-sm mb-3">{step.reasoning}</p>

                        {/* Target */}
                        {step.target && Object.keys(step.target).length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs text-muted-foreground mb-1">Target:</div>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {JSON.stringify(step.target)}
                            </code>
                          </div>
                        )}

                        {/* Observation */}
                        {step.observation && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="text-xs text-muted-foreground mb-1">Observation:</div>
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                              {(() => {
                                try {
                                  const parsed = JSON.parse(step.observation);
                                  return JSON.stringify(parsed, null, 2);
                                } catch {
                                  return step.observation;
                                }
                              })()}
                            </pre>
                          </div>
                        )}

                        {/* Error */}
                        {step.error && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="text-xs text-destructive mb-1">Error:</div>
                            <p className="text-sm text-destructive">{step.error}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Discoveries */}
            {response.discoveries.length > 0 && (
              <div className="bg-card rounded-lg border p-6">
                <h2 className="text-lg font-semibold mb-4">
                  Discoveries ({response.discoveries.length})
                </h2>

                <div className="space-y-4">
                  {response.discoveries.map((discovery, index) => (
                    <div key={discovery.id || index} className="bg-background rounded-md p-4 border">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            discovery.type === 'api_endpoint'
                              ? 'bg-blue-500/10 text-blue-500'
                              : discovery.type === 'job_data'
                              ? 'bg-green-500/10 text-green-500'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {discovery.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          confidence: {discovery.confidence}%
                        </span>
                      </div>
                      {discovery.data !== null && discovery.data !== undefined && (
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(discovery.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}