import axios, { AxiosError, InternalAxiosRequestConfig, isAxiosError } from 'axios';
import type { AuthTokens } from '../types';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../lib/tokens';

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const api = axios.create({ baseURL: API_URL });

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<AuthTokens> | null = null;

const refreshTokens = (): Promise<AuthTokens> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<AuthTokens>(`${API_URL}/auth/refresh`, { refresh_token: getRefreshToken() })
      .then((res) => {
        setTokens(res.data.access_token, res.data.refresh_token);
        return res.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    const isAuthCall = original?.url?.startsWith('/auth/') ?? false;
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      if (!getRefreshToken()) {
        clearTokens();
        return Promise.reject(error);
      }
      const usedRefresh = getRefreshToken();
      try {
        const tokens = await refreshTokens();
        original.headers.Authorization = `Bearer ${tokens.access_token}`;
        return api(original);
      } catch (refreshError) {
        const status = isAxiosError(refreshError) ? refreshError.response?.status : undefined;
        if (status !== 400 && status !== 401) {
          // Network or server failure: keep the session, let the caller retry later.
          return Promise.reject(refreshError);
        }
        // Another tab may already have rotated the tokens.
        const latestAccess = getAccessToken();
        const latestRefresh = getRefreshToken();
        if (latestAccess && latestRefresh && latestRefresh !== usedRefresh) {
          original.headers.Authorization = `Bearer ${latestAccess}`;
          return api(original);
        }
        clearTokens();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
