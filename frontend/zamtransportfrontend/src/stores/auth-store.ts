import type { AuthTokens, User } from '@/types/api'
const sessionKey = 'zambia-transport.session'
const pendingKey = 'zambia-transport.pending-registration'
export type StoredSession = AuthTokens & { user: User }
export type PendingAccount = Pick<User, 'fullName' | 'email' | 'status'>
function read<T>(key: string): T | null { try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null } catch { return null } }
export function getSession() { return read<StoredSession>(sessionKey) }
export function setSession(session: StoredSession) { localStorage.setItem(sessionKey, JSON.stringify(session)) }
export function updateSessionUser(user: User) { const session = getSession(); if (session) setSession({ ...session, user }) }
export function clearSession() { localStorage.removeItem(sessionKey) }
export function getAccessToken() { return getSession()?.accessToken ?? null }
export function getPendingAccount() { try { return JSON.parse(sessionStorage.getItem(pendingKey) ?? 'null') as PendingAccount | null } catch { return null } }
export function setPendingAccount(user: PendingAccount) { sessionStorage.setItem(pendingKey, JSON.stringify(user)) }
export function clearPendingAccount() { sessionStorage.removeItem(pendingKey) }
