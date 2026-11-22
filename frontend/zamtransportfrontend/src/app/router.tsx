// Route map for the full frontend. Public pages, authenticated pages,
// and role-restricted pages are all declared here.
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { PendingApprovalPage } from '@/features/auth/PendingApprovalPage'
import { UnauthorizedPage } from '@/features/auth/UnauthorizedPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { BackendModulePage } from '@/features/resources/BackendModulePage'
import { VehiclesPage } from '@/features/vehicles/VehiclesPage'
import { DriversPage } from '@/features/drivers/DriversPage'
import { NotFoundPage } from '@/components/shared/NotFoundPage'
import { ApprovalGuard, GuestGuard, ProtectedRoute, RoleGuard } from '@/components/shared/RouteGuards'
import { LandingPage } from '@/features/landing/LandingPage'
import { FleetMonitorPage } from '@/features/live-fleet/FleetMonitorPage'
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage'
import { SchedulesPage } from '@/features/schedules/SchedulesPage'
import { RoutesPage } from '@/features/routes/RoutesPage'
import { TerminalsPage } from '@/features/terminals/TerminalsPage'
import { TripsPage } from '@/features/trips/TripsPage'
import { DriverTripsPage } from '@/features/trips/DriverTripsPage'
import { ReportsPage } from '@/features/reports/ReportsPage'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <GuestGuard><LoginPage /></GuestGuard> },
  { path: '/register', element: <GuestGuard><RegisterPage /></GuestGuard> },
  { path: '/pending-approval', element: <PendingApprovalPage /> },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { element: <ProtectedRoute><ApprovalGuard><AppShell /></ApprovalGuard></ProtectedRoute>, children: [
    { path: 'dashboard', element: <DashboardPage /> },
    { path: 'notifications', element: <NotificationsPage /> },
    { path: 'profile', element: <ProfilePage /> },
    { path: 'operations/trips', element: <RoleGuard roles={['ADMIN']}><TripsPage /></RoleGuard> },
    { path: 'driver/trips', element: <RoleGuard roles={['DRIVER']}><DriverTripsPage /></RoleGuard> },
    { path: 'operations/schedules', element: <RoleGuard roles={['ADMIN']}><SchedulesPage /></RoleGuard> },
    { path: 'operations/routes', element: <RoleGuard roles={['ADMIN']}><RoutesPage /></RoleGuard> },
    { path: 'operations/terminals', element: <RoleGuard roles={['ADMIN']}><TerminalsPage /></RoleGuard> },
    { path: 'fleet/vehicles', element: <RoleGuard roles={['ADMIN']}><VehiclesPage /></RoleGuard> },
    { path: 'fleet/drivers', element: <RoleGuard roles={['ADMIN']}><DriversPage /></RoleGuard> },
    { path: 'fleet/assignments', element: <RoleGuard roles={['ADMIN']}><BackendModulePage title="Assignments" description="Standing vehicle and driver assignments." endpoint="/admin/assignments" collection="assignments" /></RoleGuard> },
    { path: 'monitoring/tracking', element: <RoleGuard roles={['ADMIN']}><FleetMonitorPage /></RoleGuard> },
    { path: 'administration/users', element: <RoleGuard roles={['ADMIN']}><BackendModulePage title="Users" description="System user accounts." endpoint="/admin/users" collection="users" /></RoleGuard> },
    { path: 'administration/approvals', element: <RoleGuard roles={['ADMIN']}><ApprovalsPage /></RoleGuard> },
    { path: 'administration/audit-logs', element: <RoleGuard roles={['ADMIN']}><BackendModulePage title="Audit logs" description="Administrative activity recorded by the API." endpoint="/admin/audit-logs" collection="auditLogs" /></RoleGuard> },
    { path: 'insights/reports', element: <RoleGuard roles={['ADMIN']}><ReportsPage /></RoleGuard> },
    { path: 'insights/analytics', element: <RoleGuard roles={['ADMIN']}><BackendModulePage title="Driver analytics" description="Performance analytics for drivers." endpoint="/admin/analytics/drivers" collection="items" /></RoleGuard> },
    { path: 'system/settings', element: <RoleGuard roles={['ADMIN']}><BackendModulePage title="System settings" description="Current administrative system configuration." endpoint="/admin/settings" /></RoleGuard> },
    { path: '*', element: <NotFoundPage /> },
  ] },
  { path: '*', element: <NotFoundPage /> },
])
