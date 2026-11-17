import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getSession } from '@/stores/auth-store'
import type { UserRole } from '@/types/api'
export function ProtectedRoute({ children, roles }: PropsWithChildren<{ roles?: UserRole[] }>) { const location = useLocation(); const session = getSession(); if (!session) return <Navigate to="/login" replace state={{ from: location }} />; if (roles && !roles.includes(session.user.role)) return <Navigate to="/dashboard" replace />; return children }
