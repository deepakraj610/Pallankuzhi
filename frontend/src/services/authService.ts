import api from './api';
import type { AuthTokens, RegisterPayload, User } from '../types';

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const googleLoginUrl = `${API_URL}/auth/google`;

export const registerUser = async (payload: RegisterPayload): Promise<User> => {
  const { data } = await api.post<User>('/auth/register', payload);
  return data;
};

export const loginUser = async (email: string, password: string): Promise<AuthTokens> => {
  const form = new URLSearchParams();
  form.append('username', email);
  form.append('password', password);
  const { data } = await api.post<AuthTokens>('/auth/login', form);
  return data;
};

export const fetchCurrentUser = async (): Promise<User> => {
  const { data } = await api.get<User>('/auth/me');
  return data;
};

export const logoutUser = async (refreshToken: string): Promise<void> => {
  await api.post('/auth/logout', { refresh_token: refreshToken });
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown };
      if (typeof first.msg === 'string') return first.msg;
    }
  }
  return fallback;
};
