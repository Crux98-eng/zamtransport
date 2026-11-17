import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { NotFoundPage } from '@/components/shared/NotFoundPage'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { FeaturePlaceholder } from '@/components/shared/FeaturePlaceholder'
import { LandingPage } from '@/features/landing/LandingPage'
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'vehicles', element: <FeaturePlaceholder title="Vehicles" /> },
      { path: 'trips', element: <FeaturePlaceholder title="Trips" /> },
      { path: 'drivers', element: <FeaturePlaceholder title="Drivers" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
