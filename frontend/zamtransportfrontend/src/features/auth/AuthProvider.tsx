// Authentication context: tracks the current login phase and exposes
// login, registration, logout, role, and permission helpers to components.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiError } from '@/services/api'
import { authService } from '@/services/auth'
import { disconnectSocket } from '@/services/socket'
import { clearPendingAccount, clearSession, getPendingAccount, getSession, setPendingAccount, setSession, updateSessionUser, type PendingAccount } from '@/stores/auth-store'
import type { LoginPayload, RegisterPayload, User } from '@/types/api'

type AuthPhase = 'initializing' | 'authenticated' | 'unauthenticated' | 'pending-approval' | 'session-expired' | 'account-blocked'
type AuthState = { phase: AuthPhase; user: User | null; message?: string }
type AuthContextValue = AuthState & {
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<PendingAccount>
  clearPendingRegistration: () => void
  logout: () => Promise<void>
  hasRole: (roles: User['role'][]) => boolean
  hasPermission: (permission: string) => boolean
}
const AuthContext = createContext<AuthContextValue | null>(null)

function sessionState(): AuthState {
  const session = getSession()
  if (session) return { phase: 'initializing', user: session.user }
  const pending = getPendingAccount()
  return pending ? { phase: 'pending-approval', user: null } : { phase: 'unauthenticated', user: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const [state, setState] = useState<AuthState>(sessionState)
  const clearLocalState = useCallback((phase: Extract<AuthPhase, 'unauthenticated' | 'session-expired' | 'account-blocked'>, message?: string) => {
    const user = getSession()?.user ?? null
    clearSession(); disconnectSocket(); client.clear()
    setState({ phase, user: phase === 'account-blocked' ? user : null, message })
  }, [client])

  useEffect(() => {
    const session = getSession()
    if (!session) return
    let active = true
    void authService.me().then(({ data }) => {
      if (!active) return
      updateSessionUser(data.user)
      setState({ phase: 'authenticated', user: data.user })
    }).catch((error: unknown) => {
      if (!active) return
      const issue = apiError(error)
      clearLocalState(issue.code?.startsWith('ACCOUNT_') ? 'account-blocked' : 'session-expired', issue.message)
    })
    return () => { active = false }
  }, [clearLocalState])

  useEffect(() => {
    const onSessionEnded = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { reason?: string; message?: string } : undefined
      clearLocalState(detail?.reason === 'account-blocked' ? 'account-blocked' : 'session-expired', detail?.message)
    }
    window.addEventListener('zamtransport:session-ended', onSessionEnded)
    return () => window.removeEventListener('zamtransport:session-ended', onSessionEnded)
  }, [clearLocalState])

  const login = useCallback(async (payload: LoginPayload) => {
    const { data } = await authService.login(payload)
    setSession(data)
    clearPendingAccount()
    client.clear()
    setState({ phase: 'authenticated', user: data.user })
  }, [client])
  const register = useCallback(async (payload: RegisterPayload) => {
    const { data } = await authService.register(payload)
    const pending: PendingAccount = { fullName: data.user.fullName, email: data.user.email, status: data.user.status }
    setPendingAccount(pending)
    setState({ phase: 'pending-approval', user: null })
    return pending
  }, [])
  const clearPendingRegistration = useCallback(() => {
    clearPendingAccount()
    setState({ phase: 'unauthenticated', user: null })
  }, [])
  const logout = useCallback(async () => {
    const session = getSession()
    try { if (session) await authService.logout(session.refreshToken) } finally { clearLocalState('unauthenticated') }
  }, [clearLocalState])
  const value = useMemo<AuthContextValue>(() => ({ ...state, login, register, clearPendingRegistration, logout, hasRole: (roles) => state.user !== null && roles.includes(state.user.role), hasPermission: (permission) => state.user?.permissions?.includes(permission) ?? false }), [state, login, register, clearPendingRegistration, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// This hook is intentionally colocated with its provider so consumers share one context instance.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider.')
  return context
}

