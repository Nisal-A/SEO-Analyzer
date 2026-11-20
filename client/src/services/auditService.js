import apiClient from './apiClient.js';

export const checkHealth = async ({ signal } = {}) => {
  const response = await apiClient.get('/health', { signal });
  return response.data.data;
};

export const analyzeUrl = async (url, { signal } = {}) => {
  const response = await apiClient.post('/audits/analyze', { url }, { signal });
  return response.data.data;
};

export const getAudits = async ({ page = 1, limit = 10, search = '', signal } = {}) => {
  const params = { page, limit };
  if (typeof search === 'string' && search.trim() !== '') {
    params.search = search.trim();
  }

  const response = await apiClient.get('/audits', { params, signal });
  return {
    items: response.data.data ?? [],
    meta: response.data.meta ?? { page: 1, limit, total: 0, totalPages: 0 },
  };
};

export const getAuditById = async (id, { signal } = {}) => {
  const response = await apiClient.get(`/audits/${encodeURIComponent(id)}`, { signal });
  return response.data.data;
};

// Anonymized platform-wide aggregates only (no URLs, titles, or ids).
export const getGlobalStats = async ({ signal } = {}) => {
  const response = await apiClient.get('/audits/stats', { signal });
  return response.data.data;
};

export const deleteAudit = async (id) => {
  await apiClient.delete(`/audits/${encodeURIComponent(id)}`);
  return true;
};

export default {
  checkHealth,
  analyzeUrl,
  getAudits,
  getAuditById,
  getGlobalStats,
  deleteAudit,
};
