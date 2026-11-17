import { api } from '@/services/api'
import type { ApiEnvelope, AuthTokens, LoginPayload, LoginResponse, RegisterPayload, User } from '@/types/api'
export const authService = {
  async register(payload: RegisterPayload) { return (await api.post<ApiEnvelope<{ user: User }>>('/auth/register', payload)).data },
  async login(payload: LoginPayload) { return (await api.post<ApiEnvelope<LoginResponse>>('/auth/login', payload)).data },
  async me() { return (await api.get<ApiEnvelope<{ user: User }>>('/auth/me')).data },
  async logout(refreshToken: string) { await api.post('/auth/logout', { refreshToken }) },
  async logoutAll() { await api.post('/auth/logout-all') },
  async refresh(refreshToken: string) { return (await api.post<ApiEnvelope<AuthTokens>>('/auth/refresh', { refreshToken })).data },
  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string) { return (await api.post('/auth/change-password', { currentPassword, newPassword, confirmPassword })).data },
}
