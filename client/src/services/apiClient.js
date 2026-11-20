import axios from 'axios';

const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';
const REQUEST_TIMEOUT_MS = 20000;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

// Turn every failure into { code, message } so UI code never inspects Axios internals.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);

    const apiError = error.response?.data?.error;
    const normalized = new Error(apiError?.message ?? 'Unable to reach the SEOCheck API.');
    normalized.code = apiError?.code ?? 'NETWORK_ERROR';
    normalized.status = error.response?.status ?? null;
    return Promise.reject(normalized);
  },
);

export default apiClient;

