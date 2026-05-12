import axios from 'axios';
import { API_BASE_URL } from '../config/env';

export const createApiClient = (authToken) => {
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

  return client;
};
