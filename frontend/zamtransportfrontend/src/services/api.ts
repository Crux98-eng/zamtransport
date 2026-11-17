import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { env } from '@/lib/env'
import { clearSession, getAccessToken, getSession, setSession } from '@/stores/auth-store'
import type { ApiEnvelope, AuthTokens } from '@/types/api'
export const api = axios.create({ baseURL: env.apiBaseUrl, headers: { 'Content-Type': 'application/json' } })
api.interceptors.request.use((config: InternalAxiosRequestConfig) => { const token = getAccessToken(); if (token) config.headers.Authorization = `Bearer ${token}`; return config })
let refreshPromise: Promise<string | null> | null = null
async function refreshAccessToken() { const session = getSession(); if (!session) return null; const response = await axios.post<ApiEnvelope<AuthTokens>>(`${env.apiBaseUrl}/auth/refresh`, { refreshToken: session.refreshToken }); setSession({ ...session, ...response.data.data }); return response.data.data.accessToken }
api.interceptors.response.use(undefined, async (error: AxiosError) => { const request = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined; if (error.response?.status !== 401 || !request || request._retry || request.url?.includes('/auth/refresh')) return Promise.reject(error); request._retry = true; refreshPromise ??= refreshAccessToken().finally(() => { refreshPromise = null }); const token = await refreshPromise.catch(() => null); if (!token) { clearSession(); return Promise.reject(error) }; request.headers.Authorization = `Bearer ${token}`; return api(request) })
export function apiMessage(error: unknown) { return axios.isAxiosError(error) ? (error.response?.data as { message?: string } | undefined)?.message ?? 'We could not complete that request.' : 'Something went wrong. Please try again.' }
