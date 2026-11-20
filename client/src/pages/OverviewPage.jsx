import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Clock,
  ExternalLink,
  FileSearch,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import UrlForm from '../components/audit/UrlForm.jsx';
import Alert from '../components/ui/Alert.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import useAuditHistory from '../hooks/useAuditHistory.js';
import { formatDateTime, getScoreBand, truncateUrl } from '../utils/formatters.js';

export default function OverviewPage() {
  const { audits, meta, loading, error, refetch } = useAuditHistory({
    initialPage: 1,
    limit: 5,
  });

  const hasAudits = audits.length > 0;
  const latestAudit = hasAudits ? audits[0] : null;
  const averageScore = hasAudits
    ? Math.round(audits.reduce((sum, item) => sum + (item.overallScore ?? 0), 0) / audits.length)
    : null;
  const latestBand = latestAudit ? getScoreBand(latestAudit.overallScore) : null;

  return (
    <div className="space-y-8">
      {/* Hero + URL submission */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:p-8">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Single-Page Technical & On-Page SEO Auditor</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Audit any public web page with transparent, rule-based SEO checks
          </h1>

          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Enter a full <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">https://</code> or{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">http://</code> URL below.
            SEOCheck safely fetches the page, evaluates 18 on-page and technical signals, and calculates an
            educational score out of 100.
          </p>

          <div className="pt-2">
            <UrlForm />
          </div>
        </div>
      </section>

      {/* Real summary metrics (rendered ONLY when real audits exist — zero fake stats) */}
      {hasAudits ? (
        <section aria-label="Recent audit summary metrics" className="grid gap-4 sm:grid-cols-3">
          <Card className="p-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Latest Audit Score
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-slate-900">
                {latestAudit.overallScore}
                <span className="text-base font-normal text-slate-500">/100</span>
              </span>
              {latestBand ? <Badge variant={latestBand.variant}>{latestBand.label}</Badge> : null}
            </div>
            <p className="mt-2 truncate text-xs text-slate-600" title={latestAudit.finalUrl || latestAudit.url}>
              {truncateUrl(latestAudit.finalUrl || latestAudit.url, 45)}
            </p>
          </Card>

          <Card className="p-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Recent Average (Last {audits.length})
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-slate-900">
                {averageScore}
                <span className="text-base font-normal text-slate-500">/100</span>
              </span>
              <Badge variant={getScoreBand(averageScore).variant}>
                {getScoreBand(averageScore).label}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-slate-600">Educational audit average</p>
          </Card>

          <Card className="p-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Saved Audits
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-slate-900">{meta.total}</span>
              <Link
                to="/history"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <span>View all</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-2 text-xs text-slate-600">Scoped to this browser session</p>
          </Card>
        </section>
      ) : null}

      {/* Recent Audits table / empty state */}
      <Card
        title="Recent Audits"
        subtitle="Your 5 most recent page audits saved in MongoDB"
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh</span>
            </Button>
            {hasAudits ? (
              <Link
                to="/history"
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
              >
                <span>Full History</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" label="Loading recent audits…" />
            <span className="ml-2 text-sm text-slate-600">Loading recent audits…</span>
          </div>
        ) : error ? (
          <Alert
            variant="error"
            title="Could not load recent audits"
            action={
              <Button variant="outline" size="sm" onClick={refetch}>
                Try again
              </Button>
            }
          >
            {error.message}
          </Alert>
        ) : !hasAudits ? (
          <EmptyState
            icon={FileSearch}
            title="No SEO audits yet"
            description="Submit a public URL above to run your first 18-check on-page and technical SEO audit."
          />
        ) : (
          <div className="divide-y divide-slate-200">
            {audits.map((audit) => {
              const band = getScoreBand(audit.overallScore);
              return (
                <div
                  key={audit._id}
                  className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/audits/${audit._id}`}
                        className="truncate text-sm font-semibold text-slate-900 hover:text-blue-600"
                        title={audit.finalUrl || audit.url}
                      >
                        {truncateUrl(audit.finalUrl || audit.url, 64)}
                      </Link>
                      <a
                        href={audit.finalUrl || audit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open audited URL in new tab"
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </div>

                    <p className="mt-0.5 truncate text-xs text-slate-600">
                      {audit.pageTitle || 'No <title> tag detected'}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatDateTime(audit.analyzedAt)}
                      </span>
                      <span>
                        {audit.summary?.passed ?? 0} passed · {audit.summary?.warning ?? 0} warnings ·{' '}
                        {audit.summary?.failed ?? 0} failed
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg font-bold text-slate-900">
                        {audit.overallScore}
                        <span className="text-xs font-normal text-slate-500">/100</span>
                      </span>
                      <Badge variant={band.variant}>{band.label}</Badge>
                    </div>

                    <Link
                      to={`/audits/${audit._id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      <BarChart3 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      <span>View Report</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
