import { Link } from 'react-router-dom';
import { Clock, Search } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

// Placeholder shell for Sprint 5. Replaced with full search, pagination, and delete modal in Sprint 7.
export default function AuditHistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit History</h1>
        <p className="mt-1 text-sm text-slate-600">
          Browse and manage previously saved SEO audit reports for this browser session.
        </p>
      </div>

      <Card>
        <EmptyState
          icon={Clock}
          title="Audit History Workspace"
          description="Use the Overview or Analyze page to run live audits. Full history search, pagination, and report management arrive in Sprint 7."
          action={
            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>Analyze a URL</span>
            </Link>
          }
        />
      </Card>
    </div>
  );
}
