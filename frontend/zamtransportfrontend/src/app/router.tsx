import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { PendingApprovalPage } from '@/features/auth/PendingApprovalPage'
import { UnauthorizedPage } from '@/features/auth/UnauthorizedPage'
import { NotFoundPage } from '@/components/shared/NotFoundPage'
import { ApprovalGuard, GuestGuard, ProtectedRoute, RoleGuard } from '@/components/shared/RouteGuards'
import { FeaturePlaceholder } from '@/components/shared/FeaturePlaceholder'
import { LandingPage } from '@/features/landing/LandingPage'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage />},
  { path: '/register', element: <GuestGuard><RegisterPage /></GuestGuard> },
  { path: '/pending-approval', element: <PendingApprovalPage /> },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '/', element: <ProtectedRoute><ApprovalGuard><AppShell /></ApprovalGuard></ProtectedRoute>, children: [
    { index: true, element: <Navigate to="/dashboard" replace /> },
    { path: 'dashboard', element: <DashboardPage /> },
    { path: 'vehicles', element: <RoleGuard roles={['ADMIN']}><FeaturePlaceholder title="Vehicles" /></RoleGuard> },
    { path: 'trips', element: <RoleGuard roles={['ADMIN']}><FeaturePlaceholder title="Trips" /></RoleGuard> },
    { path: 'drivers', element: <RoleGuard roles={['ADMIN']}><FeaturePlaceholder title="Drivers" /></RoleGuard> },
  ] },
  { path: '*', element: <NotFoundPage /> },
])
