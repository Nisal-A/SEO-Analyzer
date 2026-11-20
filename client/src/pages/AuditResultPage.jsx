import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Alert from '../components/ui/Alert.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import useAuditDetail from '../hooks/useAuditDetail.js';
import { formatDateTime, getScoreBand } from '../utils/formatters.js';

// Shell view for Sprint 5 so navigating to /audits/:id after UrlForm submission
// immediately displays the real saved audit. Expanded with full visualizations in Sprint 6.
export default function AuditResultPage() {
  const { id } = useParams();
  const { audit, loading, error, refetch } = useAuditDetail(id);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" label="Loading audit report…" />
        <p className="mt-3 text-sm font-medium text-slate-600">Loading audit report…</p>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Overview</span>
        </Link>

        <Alert
          variant="error"
          title="Could not load audit report"
          action={
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          }
        >
          {error?.message || 'The requested audit report was not found.'}
        </Alert>
      </div>
    );
  }

  const band = getScoreBand(audit.overallScore);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Overview</span>
        </Link>
        <span className="text-xs text-slate-500">Analyzed {formatDateTime(audit.analyzedAt)}</span>
      </div>

      <Card>
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Educational SEO Audit Report
            </p>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {audit.pageTitle || audit.finalUrl || audit.url}
            </h1>
            <a
              href={audit.finalUrl || audit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 break-all text-sm text-blue-600 hover:underline"
            >
              <span>{audit.finalUrl || audit.url}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-bold text-slate-900">
                {audit.overallScore}
                <span className="text-base font-normal text-slate-500">/100</span>
              </div>
              <p className="text-xs text-slate-500">Based on {audit.scoreCoverage}% of checks</p>
            </div>
            <Badge variant={band.variant}>{band.label}</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
