import axios from 'axios';
import { API_BASE_URL } from '../config/env';

export const createApiClient = (authToken, options = {}) => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  client.interceptors.request.use((config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (authToken && error.response?.status === 401 && options.onUnauthorized) {
        await options.onUnauthorized();
      }
      return Promise.reject(error);
    }
  );

  return client;
};
