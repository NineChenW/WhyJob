/**
 * Explorer Agent Admin Page - Client Component
 *
 * Orchestrates the 3 sections:
 * 1. Submit New Task form
 * 2. Pending Tasks list
 * 3. Exploration Results
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { TaskForm } from './task-form';
import { TaskList } from './task-list';
import { ExplorationResults } from './exploration-results';
import {
  getActiveTasksAction,
  getTaskHistoryAction,
} from '@/actions/explorer';
import type { FetchTask } from '@prisma/client';

interface ExplorerPageClientProps {
  companies: Array<{ id: string; name: string }>;
  initialActiveTasks: FetchTask[];
  initialHistoryTasks: FetchTask[];
}

export function ExplorerPageClient({
  companies,
  initialActiveTasks,
  initialHistoryTasks,
}: ExplorerPageClientProps) {
  const [activeTasks, setActiveTasks] = useState(initialActiveTasks);
  const [historyTasks, setHistoryTasks] = useState(initialHistoryTasks);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Refresh data when refreshKey changes
  useEffect(() => {
    async function fetchData() {
      const [activeResult, historyResult] = await Promise.all([
        getActiveTasksAction(),
        getTaskHistoryAction(),
      ]);

      if (activeResult.success) {
        setActiveTasks(activeResult.data);
      }
      if (historyResult.success) {
        setHistoryTasks(historyResult.data);
      }
    }
    fetchData();
  }, [refreshKey]);

  // Build company map for display
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  // Attach company names to tasks
  const activeTasksWithCompany = activeTasks.map((t) => ({
    ...t,
    companyName: companyMap.get(t.companyId) ?? null,
  }));

  const historyTasksWithCompany = historyTasks.map((t) => ({
    ...t,
    companyName: companyMap.get(t.companyId) ?? null,
  }));

  return (
    <div className="space-y-8">
      {/* Section 1: Submit New Task */}
      <TaskForm companies={companies} />

      {/* Section 2: Pending Tasks */}
      <TaskList tasks={activeTasksWithCompany} />

      {/* Section 3: Exploration Results */}
      <ExplorationResults tasks={historyTasksWithCompany} />
    </div>
  );
}