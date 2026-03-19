// ============================================================
// NxtStep — Auth API
// ============================================================

import apiClient, { unwrapData } from './client';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from '@/types';

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient
      .post<{ success: boolean; data: AuthResponse }>('/auth/register', data)
      .then((res) => res.data.data!),

  login: (data: LoginRequest) =>
    apiClient
      .post<{ success: boolean; data: AuthResponse }>('/auth/login', data)
      .then((res) => res.data.data!),

  verifyEmail: (otp: string) =>
    apiClient
      .post<{ success: boolean; data: AuthResponse }>('/auth/verify-email', { otp })
      .then((res) => res.data.data!),

  resendOtp: () =>
    apiClient
      .post<{ success: boolean; message: string }>('/auth/resend-otp')
      .then((res) => res.data),

  forgotPassword: (email: string) =>
    apiClient
      .post<{ success: boolean; message: string }>('/auth/forgot-password', { email })
      .then((res) => res.data),

  resetPassword: (token: string, password: string) =>
    apiClient
      .post<{ success: boolean; message: string }>('/auth/reset-password', { token, password })
      .then((res) => res.data),

  getProfile: () =>
    apiClient
      .get<{ success: boolean; data: User }>('/auth/me')
      .then((res) => res.data.data!),

  updateSettings: (data: { name?: string; rolePreferences?: string[]; interests?: string[] }) =>
    apiClient
      .patch<{ success: boolean; data: User }>('/auth/me', data)
      .then((res) => res.data.data!),
};
