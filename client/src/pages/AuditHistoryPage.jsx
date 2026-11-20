import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Clock, RefreshCw, Search, SearchX } from 'lucide-react';
import HistoryTable from '../components/history/HistoryTable.jsx';
import Pagination from '../components/history/Pagination.jsx';
import SearchBar from '../components/history/SearchBar.jsx';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import useAuditHistory from '../hooks/useAuditHistory.js';

export default function AuditHistoryPage() {
  const {
    audits,
    meta,
    page,
    setPage,
    search,
    setSearch,
    loading,
    error,
    refetch,
    removeAudit,
  } = useAuditHistory({ initialPage: 1, limit: 10 });

  const handleSearchChange = useCallback(
    (nextQuery) => {
      setPage(1);
      setSearch(nextQuery);
    },
    [setPage, setSearch],
  );

  const hasSearchQuery = search.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit History</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search, revisit, or delete SEO audits saved for this browser session.
          </p>
        </div>

        <Link
          to="/analyze"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span>New Audit</span>
        </Link>
      </div>

      <Card>
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <SearchBar value={search} onChange={handleSearchChange} />

          <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" label="Loading audit history…" />
            <span className="ml-2 text-sm text-slate-600">Loading audit history…</span>
          </div>
        ) : error ? (
          <Alert
            variant="error"
            title="Could not load audit history"
            action={
              <Button variant="outline" size="sm" onClick={refetch}>
                Retry
              </Button>
            }
          >
            {error.message}
          </Alert>
        ) : audits.length === 0 ? (
          hasSearchQuery ? (
            <EmptyState
              icon={SearchX}
              title="No matching audits found"
              description={`No saved audits matched "${search.trim()}". Try a different domain or clear your search filter.`}
              action={
                <Button variant="outline" size="sm" onClick={() => handleSearchChange('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Clock}
              title="No saved audits yet"
              description="Run your first SEO audit to start building a searchable history of page reports."
              action={
                <Link
                  to="/analyze"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <span>Analyze a Website</span>
                </Link>
              }
            />
          )
        ) : (
          <div className="space-y-6">
            <HistoryTable audits={audits} onDelete={removeAudit} />
            <Pagination
              page={meta.page ?? page}
              totalPages={meta.totalPages ?? 0}
              total={meta.total ?? audits.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
