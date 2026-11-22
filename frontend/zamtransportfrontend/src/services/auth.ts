import { api } from '@/services/api'
import type { ApiEnvelope, AuthTokens, DriverRegisterPayload, EmailVerificationResponse, LoginPayload, LoginResponse, PasswordResetPayload, RegistrationResponse, RegisterPayload, User } from '@/types/api'
export const authService = {
  async register(payload: RegisterPayload) { return (await api.post<ApiEnvelope<RegistrationResponse>>('/auth/register', payload)).data },
  async registerDriver(payload: DriverRegisterPayload) { return (await api.post<ApiEnvelope<RegistrationResponse>>('/auth/register/driver', payload)).data },
  async verifyEmail(token: string) { return (await api.post<ApiEnvelope<EmailVerificationResponse>>('/auth/verify-email', { token })).data },
  async resendVerification(email: string) { return (await api.post<{ success: true; message: string }>('/auth/resend-verification', { email })).data },
  async requestPasswordReset(email: string) { return (await api.post<{ success: true; message: string }>('/auth/forgot-password', { email })).data },
  async resetPassword(payload: PasswordResetPayload) { return (await api.post<{ success: true; message: string }>('/auth/reset-password', payload)).data },
  async login(payload: LoginPayload) { return (await api.post<ApiEnvelope<LoginResponse>>('/auth/login', payload)).data },
  async me() { return (await api.get<ApiEnvelope<{ user: User }>>('/auth/me')).data },
  async logout(refreshToken: string) { await api.post('/auth/logout', { refreshToken }) },
  async logoutAll() { await api.post('/auth/logout-all') },
  async refresh(refreshToken: string) { return (await api.post<ApiEnvelope<AuthTokens>>('/auth/refresh', { refreshToken })).data },
  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string) { return (await api.post('/auth/change-password', { currentPassword, newPassword, confirmPassword })).data },
}
