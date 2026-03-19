// ============================================================
// NxtStep — Axios API Client
// JWT interceptors, refresh logic, error normalisation
// ============================================================

import axios, { AxiosError, type AxiosInstance, type AxiosResponse } from 'axios';
import type { ApiResponse } from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Create Axios Instance ─────────────────────────────────────
export const apiClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request Interceptor — Attach JWT ─────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nxtstep-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor — Unwrap + handle 401 ───────────────
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      // Clear stale auth and redirect to login
      localStorage.removeItem('nxtstep-token');
      localStorage.removeItem('nxtstep-user');
      // Avoid circular imports — use window.location
      if (
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/register' &&
        !window.location.pathname.startsWith('/reset-password')
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Helper: extract data from ApiResponse wrapper ────────────
export function unwrapData<T>(response: AxiosResponse<ApiResponse<T>>): T {
  if (!response.data.success) {
    throw new Error(response.data.message || 'Request failed');
  }
  return response.data.data as T;
}

// ── Helper: extract error message ────────────────────────────
export function extractErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiResponse | undefined;
    if (data?.message) return data.message;
    if (data?.error?.message) return data.error.message;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

export default apiClient;