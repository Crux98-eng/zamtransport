import type { AuthTokens, User } from '@/types/api'
const tokenKey = 'zambia-transport.session'
type Session = AuthTokens & { user: User }
export function getSession(): Session | null { try { return JSON.parse(localStorage.getItem(tokenKey) ?? 'null') as Session | null } catch { return null } }
export function setSession(session: Session) { localStorage.setItem(tokenKey, JSON.stringify(session)) }
export function clearSession() { localStorage.removeItem(tokenKey) }
export function getAccessToken() { return getSession()?.accessToken ?? null }
