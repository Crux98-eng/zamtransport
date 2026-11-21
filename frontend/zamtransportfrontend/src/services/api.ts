import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { env } from '@/lib/env'
import { clearSession, getAccessToken, getSession, setSession } from '@/stores/auth-store'
import type { ApiEnvelope, ApiError, AuthTokens } from '@/types/api'

const API_TIMEOUT_MS = 60_000
export const api = axios.create({ baseURL: env.apiBaseUrl, timeout: API_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } })
api.interceptors.request.use((config: InternalAxiosRequestConfig) => { const token = getAccessToken(); if (token) config.headers.Authorization = `Bearer ${token}`; return config })
let refreshPromise: Promise<string | null> | null = null
// Refreshing `/auth/me` is required to restore a valid session after an access
// token expires; endpoints that issue or revoke credentials must never retry.
const excludesRefresh = (url?: string) => ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/logout-all'].some((endpoint) => url?.startsWith(endpoint))
async function refreshAccessToken() { const session = getSession(); if (!session) return null; const response = await axios.post<ApiEnvelope<AuthTokens>>(`${env.apiBaseUrl}/auth/refresh`, { refreshToken: session.refreshToken }, { timeout: API_TIMEOUT_MS }); setSession({ ...session, ...response.data.data }); return response.data.data.accessToken }
type SessionEndReason = 'expired' | 'account-blocked'
function endSession(reason: SessionEndReason = 'expired', message?: string) { clearSession(); window.dispatchEvent(new CustomEvent('zamtransport:session-ended', { detail: { reason, message } })) }
api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const request = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
  const body = error.response?.data as Partial<ApiError> | undefined
  if (error.response?.status === 403 && body?.code?.startsWith('ACCOUNT_')) endSession('account-blocked', body.message)
  if (!request || excludesRefresh(request.url) || error.response?.status !== 401 || request._retry) return Promise.reject(error)
  request._retry = true
  refreshPromise ??= refreshAccessToken().finally(() => { refreshPromise = null })
  const token = await refreshPromise.catch(() => null)
  if (!token) { endSession(); return Promise.reject(error) }
  request.headers.Authorization = `Bearer ${token}`
  return api(request)
})
export function apiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiError> | undefined
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const validationMessage = body?.errors?.map((issue) => issue.message.trim()).filter(Boolean).join(' ')
    return {
      success: false,
      message: message || validationMessage || (
        error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
          ? 'The request timed out. It may still have completed; check before retrying.'
          : error.code === 'ERR_NETWORK'
            ? 'Could not reach the server. Check your connection and try again.'
            : 'We could not complete that request.'
      ),
      code: body?.code,
      status: error.response?.status,
      errors: body?.errors,
    }
  }
  return { success: false, message: 'Something went wrong. Please try again.' }
}
export function apiMessage(error: unknown) { return apiError(error).message }
