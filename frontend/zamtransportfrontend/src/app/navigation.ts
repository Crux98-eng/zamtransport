import type { LucideIcon } from 'lucide-react'
import { BarChart3, Bell, BusFront, ClipboardList, FileBarChart, LayoutDashboard, MapPinned, Map, Route, Settings, ShieldCheck, UserRound, Users, Waypoints } from 'lucide-react'
import type { User, UserRole } from '@/types/api'

export type NavigationItem = { label: string; to: string; icon: LucideIcon; roles?: UserRole[]; permission?: string; available?: boolean }
export type NavigationGroup = { label: string; items: NavigationItem[] }
export type Breadcrumb = { label: string; to?: string }

export const navigationGroups: NavigationGroup[] = [
  { label: 'Overview', items: [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  ] },
  { label: 'Operations', items: [
    { label: 'Trips', to: '/operations/trips', icon: ClipboardList, roles: ['ADMIN'] },
    { label: 'My trips', to: '/driver/trips', icon: ClipboardList, roles: ['DRIVER'] },
    { label: 'Scheduled trips', to: '/commuter/trips', icon: ClipboardList, roles: ['COMMUTER'] },
    { label: 'Schedules', to: '/operations/schedules', icon: ClipboardList, roles: ['ADMIN'] },
    { label: 'Routes', to: '/operations/routes', icon: Route, roles: ['ADMIN'] },
    { label: 'Terminals', to: '/operations/terminals', icon: MapPinned, roles: ['ADMIN'] },
  ] },
  { label: 'Fleet', items: [
    { label: 'Vehicles', to: '/fleet/vehicles', icon: BusFront, roles: ['ADMIN'] },
    { label: 'Drivers', to: '/fleet/drivers', icon: Users, roles: ['ADMIN'] },
    { label: 'Assignments', to: '/fleet/assignments', icon: Waypoints, roles: ['ADMIN'] },
  ] },
  { label: 'Monitoring', items: [
    { label: 'Live tracking', to: '/monitoring/tracking', icon: Map, roles: ['ADMIN'] },
    { label: 'Notifications', to: '/notifications', icon: Bell },
  ] },
  { label: 'Administration', items: [
    { label: 'Users', to: '/administration/users', icon: Users, roles: ['ADMIN'] },
    { label: 'Approvals', to: '/administration/approvals', icon: ShieldCheck, roles: ['ADMIN'] },
    { label: 'Audit logs', to: '/administration/audit-logs', icon: ClipboardList, roles: ['ADMIN'] },
  ] },
  { label: 'Insights', items: [
    { label: 'Reports', to: '/insights/reports', icon: FileBarChart, roles: ['ADMIN'] },
    { label: 'Analytics', to: '/insights/analytics', icon: BarChart3, roles: ['ADMIN'] },
  ] },
  { label: 'System', items: [{ label: 'Settings', to: '/system/settings', icon: Settings, roles: ['ADMIN'] }] },
]

// These backend modules exist, but their management screens are intentionally
// withheld until their dedicated frontend phases rather than linking to mocks.
export const futureNavigationCandidates = ['Bookings: no booking API currently exists.', 'Create/edit workflows and operational actions will be added when their dedicated forms are specified.']

const pageLabels: Array<{ pattern: string; label: string; parent?: Breadcrumb }> = [
  { pattern: '/dashboard', label: 'Dashboard' },
  { pattern: '/driver/trips', label: 'My trips' },
  { pattern: '/notifications', label: 'Notifications' },
  { pattern: '/profile', label: 'My profile' },
  { pattern: '/operations/trips', label: 'Trips' }, { pattern: '/operations/schedules', label: 'Schedules' }, { pattern: '/operations/routes', label: 'Routes' }, { pattern: '/operations/terminals', label: 'Terminals' },
  { pattern: '/commuter/trips', label: 'Scheduled trips' },
  { pattern: '/fleet/vehicles', label: 'Vehicles' }, { pattern: '/fleet/drivers', label: 'Drivers' }, { pattern: '/fleet/assignments', label: 'Assignments' }, { pattern: '/monitoring/tracking', label: 'Live tracking' },
  { pattern: '/administration/users', label: 'Users' }, { pattern: '/administration/approvals', label: 'Approvals' }, { pattern: '/administration/audit-logs', label: 'Audit logs' }, { pattern: '/insights/reports', label: 'Reports' }, { pattern: '/insights/analytics', label: 'Analytics' }, { pattern: '/system/settings', label: 'Settings' },
]

export function navigationItemAllowed(item: NavigationItem, user: User | null) {
  if (!user || item.available === false) return false
  if (item.roles && !item.roles.includes(user.role)) return false
  return !item.permission || user.permissions?.includes(item.permission) === true
}

export function navigationFor(user: User | null) {
  return navigationGroups.map((group) => ({ ...group, items: group.items.filter((item) => navigationItemAllowed(item, user)) })).filter((group) => group.items.length > 0)
}

export function breadcrumbsFor(pathname: string): Breadcrumb[] {
  const match = pageLabels.find((page) => new RegExp(`^${page.pattern.replace(/:[^/]+/g, '[^/]+')}/?$`).test(pathname))
  return match ? [{ label: 'Workspace', to: '/dashboard' }, ...(match.parent ? [match.parent] : []), { label: match.label }] : [{ label: 'Workspace', to: '/dashboard' }]
}

export const profileNavigationItem: NavigationItem = { label: 'My profile', to: '/profile', icon: UserRound }
