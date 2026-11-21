// Route guards protect pages from unauthenticated users and wrong roles.
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { FullPageLoading } from '@/components/shared/FullPageLoading'
import type { UserRole } from '@/types/api'

function returnTo(location: ReturnType<typeof useLocation>) { return `${location.pathname}${location.search}${location.hash}` }

export function GuestGuard({ children }: { children: ReactNode }) {
  const { phase } = useAuth()
  if (phase === 'initializing') return <FullPageLoading />
  if (phase === 'authenticated') return <Navigate to="/dashboard" replace />
  if (phase === 'pending-approval') return <Navigate to="/pending-approval" replace />
  return <>{children}</>
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.phase === 'initializing') return <FullPageLoading />
  if (auth.phase !== 'authenticated') return <Navigate to="/" replace state={{ from: returnTo(location), message: auth.message }} />
  return <>{children}</>
}

export function ApprovalGuard({ children }: { children: ReactNode }) {
  const { phase, message } = useAuth()
  if (phase === 'pending-approval') return <Navigate to="/pending-approval" replace />
  if (phase !== 'authenticated') return <Navigate to="/login" replace state={{ message }} />
  return <>{children}</>
}

export function RoleGuard({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { hasRole } = useAuth()
  return hasRole(roles) ? <>{children}</> : <Navigate to="/unauthorized" replace />
}

/** The API currently exposes roles but no granular permission collection. Use this guard when that collection is supplied. */
export function PermissionGuard({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission } = useAuth()
  return hasPermission(permission) ? <>{children}</> : <Navigate to="/unauthorized" replace />
}
