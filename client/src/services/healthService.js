import apiClient from './apiClient.js';

/** @returns {Promise<{ status: string, db: 'connected' | 'disconnected', timestamp: string }>} */
export const getHealth = async ({ signal } = {}) => {
  const response = await apiClient.get('/health', { signal });
  return response.data.data;
};

