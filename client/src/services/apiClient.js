import axios from 'axios';
import { getFriendlyErrorMessage } from '../utils/constants.js';
import { getOrCreateClientId } from '../utils/formatters.js';

const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';
const REQUEST_TIMEOUT_MS = 25000;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
  },
});

// Attach anonymous per-browser X-Client-Id header on every API request (ADR-015 Option B).
apiClient.interceptors.request.use((config) => {
  const clientId = getOrCreateClientId();
  if (clientId) {
    config.headers['X-Client-Id'] = clientId;
  }
  return config;
});

// Normalize every error into { code, message, status } with a user-safe message.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const apiError = error.response?.data?.error;
    const code = apiError?.code ?? 'NETWORK_ERROR';
    const friendlyMessage = getFriendlyErrorMessage({
      code,
      message: apiError?.message,
    });

    const normalized = new Error(friendlyMessage);
    normalized.code = code;
    normalized.serverMessage = apiError?.message ?? null;
    normalized.status = error.response?.status ?? null;
    return Promise.reject(normalized);
  },
);

export default apiClient;
