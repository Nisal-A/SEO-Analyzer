import { useCallback, useEffect, useState } from 'react';
import { deleteAudit, getAudits } from '../services/auditService.js';

export function useAuditHistory({ initialPage = 1, limit = 10, initialSearch = '' } = {}) {
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState(initialSearch);
  const [audits, setAudits] = useState([]);
  const [meta, setMeta] = useState({ page: initialPage, limit, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(
    async ({ targetPage = page, targetSearch = search, signal } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const result = await getAudits({
          page: targetPage,
          limit,
          search: targetSearch,
          signal,
        });
        setAudits(result.items);
        setMeta(result.meta);
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        setError({
          code: err.code ?? 'NETWORK_ERROR',
          message: err.message || 'Unable to load audit history.',
        });
      } finally {
        setLoading(false);
      }
    },
    [page, limit, search],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchHistory({ targetPage: page, targetSearch: search, signal: controller.signal });
    return () => controller.abort();
  }, [page, search, fetchHistory]);

  const removeAudit = useCallback(
    async (id) => {
      await deleteAudit(id);
      // If deleting the final item on a page > 1, step back cleanly instead of stranding on an empty page.
      if (audits.length <= 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1));
        return;
      }
      await fetchHistory({ targetPage: page, targetSearch: search });
    },
    [audits.length, fetchHistory, page, search],
  );

  return {
    audits,
    meta,
    page,
    setPage,
    search,
    setSearch,
    loading,
    error,
    refetch: () => fetchHistory({ targetPage: page, targetSearch: search }),
    removeAudit,
  };
}

export default useAuditHistory;
