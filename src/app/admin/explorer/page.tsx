/**
 * Explorer Agent Admin Page Route
 */

import { getCompanies } from '@/actions/companies';
import {
  getActiveTasksAction,
  getTaskHistoryAction,
} from '@/actions/explorer';
import { ExplorerPageClient } from '@/components/admin/explorer/explorer-page';

export const metadata = {
  title: 'Explorer Agent - Admin',
};

export default async function ExplorerAdminPage() {
  // Fetch companies for dropdown
  const companies = await getCompanies();

  // Fetch initial task data
  const [activeResult, historyResult] = await Promise.all([
    getActiveTasksAction(),
    getTaskHistoryAction(),
  ]);

  const initialActiveTasks = activeResult.success ? activeResult.data : [];
  const initialHistoryTasks = historyResult.success ? historyResult.data : [];

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Explorer Agent</h1>
        <p className="text-muted-foreground">
          Submit exploration tasks and manage results
        </p>
      </div>

      <ExplorerPageClient
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        initialActiveTasks={initialActiveTasks}
        initialHistoryTasks={initialHistoryTasks}
      />
    </div>
  );
}