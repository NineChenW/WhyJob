/**
 * Task List - Pending and Exploring Tasks
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cancelTaskAction } from '@/actions/explorer';
import { ExplorationStatusBadge } from './status-badge';
import type { FetchTask } from '@prisma/client';

const CONTENT_TYPE_LABELS: Record<string, string> = {
  job_listing: 'Job Listings',
  company_culture: 'Company Culture',
  company_wechat: 'WeChat',
};

interface TaskListProps {
  tasks: Array<FetchTask & { companyName?: string | null }>;
}

export function TaskList({ tasks }: TaskListProps) {
  const router = useRouter();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (taskId: string) => {
    setCancellingId(taskId);
    try {
      const result = await cancelTaskAction(taskId);
      if (result.success) {
        toast.success('Task cancelled');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to cancel task');
      }
    } catch {
      toast.error('Failed to cancel task');
    } finally {
      setCancellingId(null);
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Explorations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pending explorations.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Explorations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header */}
          <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
            <div>Company</div>
            <div>Content Types</div>
            <div>Status</div>
            <div>Action</div>
          </div>
          {/* Rows */}
          {tasks.map((task) => (
            <div key={task.id} className="grid grid-cols-4 gap-4 items-center text-sm">
              <div className="font-medium truncate">{task.companyName ?? task.companyId}</div>
              <div className="text-muted-foreground truncate">
                {task.contentTypes.map((ct) => CONTENT_TYPE_LABELS[ct] ?? ct).join(', ')}
              </div>
              <div>
                <ExplorationStatusBadge status={task.status} />
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(task.id)}
                  disabled={cancellingId === task.id || task.status !== 'pending'}
                >
                  {cancellingId === task.id ? 'Cancelling...' : 'Cancel'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}