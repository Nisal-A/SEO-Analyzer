// Temporary diagnostic page for M1 (Foundation). Replaced by the real UI in Sprint 5.
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { getHealth } from './services/healthService.js';

const BADGE_STYLES = {
  ok: 'bg-green-50 text-green-800 ring-green-600/20',
  error: 'bg-red-50 text-red-800 ring-red-600/20',
  loading: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

const BADGE_ICONS = { ok: CheckCircle2, error: XCircle, loading: Loader2 };

// Status is conveyed by icon + text, never by colour alone (ADR-016).
function StatusBadge({ label, state, text }) {
  const Icon = BADGE_ICONS[state];
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
      <span className="font-medium text-slate-900">{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${BADGE_STYLES[state]}`}
      >
        <Icon className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
        {text}
      </span>
    </div>
  );
}

export default function App() {
  const [health, setHealth] = useState({ state: 'loading', data: null, error: null });

  const loadHealth = useCallback(async (signal) => {
    setHealth((previous) => ({ ...previous, state: 'loading', error: null }));
    try {
      const data = await getHealth({ signal });
      setHealth({ state: 'success', data, error: null });
    } catch (error) {
      if (axios.isCancel(error)) return;
      setHealth({ state: 'error', data: null, error });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadHealth(controller.signal);
    return () => controller.abort();
  }, [loadHealth]);

  const { state, data, error } = health;
  const isLoading = state === 'loading';

  const apiBadge = isLoading
    ? { state: 'loading', text: 'Checking…' }
    : state === 'success'
      ? { state: 'ok', text: 'Online' }
      : { state: 'error', text: 'Offline' };

  const dbBadge = isLoading
    ? { state: 'loading', text: 'Checking…' }
    : data?.db === 'connected'
      ? { state: 'ok', text: 'Connected' }
      : { state: 'error', text: state === 'success' ? 'Disconnected' : 'Unknown' };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">SEOCheck – System Health</h1>
        <p className="mt-1 text-sm text-slate-600">Live status of the SEOCheck API and its MongoDB connection.</p>

        <div className="mt-6 space-y-3" aria-live="polite">
          <StatusBadge label="API" {...apiBadge} />
          <StatusBadge label="MongoDB" {...dbBadge} />
        </div>

        {state === 'error' && (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error.message}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
          <span>
            {data?.timestamp ? `Last checked: ${new Date(data.timestamp).toLocaleString()}` : 'Not checked yet'}
          </span>
          <button
            type="button"
            onClick={() => loadHealth()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </section>
    </main>
  );
}

