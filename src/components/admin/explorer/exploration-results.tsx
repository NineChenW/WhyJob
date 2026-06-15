/**
 * Exploration Results - Completed and Failed Tasks
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { retryTaskAction, upsertConfigAction } from '@/actions/explorer';
import { ExplorationStatusBadge, ConfidenceBadge } from './status-badge';
import { ConfigPreview } from './config-preview';
import type { FetchTask } from '@prisma/client';

const CONTENT_TYPE_LABELS: Record<string, string> = {
  job_listing: 'Job Listings',
  company_culture: 'Company Culture',
  company_wechat: 'WeChat',
};

interface ExplorationResultProps {
  tasks: Array<FetchTask & { companyName?: string | null }>;
}

export function ExplorationResults({ tasks }: ExplorationResultProps) {
  const router = useRouter();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  type TaskWithCompany = FetchTask & { companyName?: string | null };

  const handleApprove = async (task: TaskWithCompany) => {
    if (!task.config) {
      toast.error('No config to approve');
      return;
    }

    setApprovingId(task.id);
    try {
      // Upsert the config - use first content type for the name
      const contentType = task.contentTypes[0] ?? 'job_listing';
      const configData = task.config as Record<string, unknown>;

      const result = await upsertConfigAction(task.companyId, contentType as never, {
        name: `${task.companyName ?? 'Config'} - ${CONTENT_TYPE_LABELS[contentType] ?? contentType}`,
        url: (configData.url as string) ?? '',
        method: (configData.method as 'GET' | 'POST') ?? 'GET',
        headers: (configData.headers as Record<string, string>) ?? {},
        params: (configData.params as Record<string, string>) ?? {},
        parseWith: (configData.parseWith as 'json' | 'cheerio') ?? 'json',
        selectors: configData.selectors as Record<string, string> | undefined,
        pagination: configData.pagination as never,
        authRequired: (configData.authRequired as boolean) ?? false,
        authNote: configData.authNote as string | undefined,
        isActive: true,
        intervalHours: configData.intervalHours as number | undefined,
      });

      if (result.success) {
        toast.success('Config approved and saved');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to approve config');
      }
    } catch {
      toast.error('Failed to approve config');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRetry = async (taskId: string) => {
    setRetryingId(taskId);
    try {
      const result = await retryTaskAction(taskId);
      if (result.success) {
        toast.success('Task reset to pending');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to retry task');
      }
    } catch {
      toast.error('Failed to retry task');
    } finally {
      setRetryingId(null);
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exploration Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No completed explorations yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exploration Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {tasks.map((task) => {
          const contentType = task.contentTypes[0] ?? 'unknown';
          const isComplete = task.status === 'complete';
          const isFailed = task.status === 'failed';

          return (
            <div key={task.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">
                    {task.companyName ?? task.companyId} - {CONTENT_TYPE_LABELS[contentType] ?? contentType}
                  </h3>
                  <ExplorationStatusBadge status={task.status} />
                  {task.confidence !== null && task.confidence !== undefined && (
                    <ConfidenceBadge confidence={task.confidence} />
                  )}
                  {task.iterations > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Iterations: {task.iterations}
                    </span>
                  )}
                </div>
              </div>

              {isComplete && task.config && (
                <>
                  <ConfigPreview config={task.config} />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(task)}
                      disabled={approvingId === task.id}
                    >
                      {approvingId === task.id ? 'Saving...' : 'Approve & Save'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(task.id)}
                      disabled={retryingId === task.id}
                    >
                      {retryingId === task.id ? 'Retrying...' : 'Retry'}
                    </Button>
                  </div>
                </>
              )}

              {isFailed && (
                <>
                  <div className="text-sm">
                    {task.reason && (
                      <p className="text-muted-foreground">Reason: {task.reason}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(task.id)}
                      disabled={retryingId === task.id}
                    >
                      {retryingId === task.id ? 'Retrying...' : 'Try Again'}
                    </Button>
                  </div>
                </>
              )}

              <Separator />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}