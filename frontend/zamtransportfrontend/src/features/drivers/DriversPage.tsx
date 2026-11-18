import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  CheckCircle2,
  AlertOctagon,
  ShieldOff,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  X,
  CreditCard,
  Phone,
  Eye,
  Edit,
  ShieldCheck,
  Bus,
  LoaderCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/forms/TextField'
import { SelectField } from '@/components/forms/SelectField'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState } from '@/components/shared/PageState'
import { driversService } from '@/services/drivers'
import { apiMessage } from '@/services/api'
import { cn } from '@/lib/utils'
import type { Driver, DriverStatus, DriverQueryParams } from '@/types/drivers'

import { RegisterDriverModal } from './RegisterDriverModal'
import { EditDriverModal } from './EditDriverModal'
import { ChangeDriverStatusModal } from './ChangeDriverStatusModal'
import { AssignVehicleToDriverModal } from './AssignVehicleToDriverModal'
import { DriverDetailsModal } from './DriverDetailsModal'

function statusTone(status: DriverStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'INACTIVE':
      return 'neutral'
    case 'SUSPENDED':
    case 'REJECTED':
      return 'danger'
    case 'PENDING':
    default:
      return 'warning'
  }
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function daysUntilExpiry(isoDate?: string) {
  if (!isoDate) return null
  const diffTime = new Date(isoDate).getTime() - Date.now()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function DriversPage() {
  const queryClient = useQueryClient()

  // Query state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Toast feedback message
  const [toastMessage, setToastMessage] = useState<{
    tone: 'success' | 'error'
    text: string
  } | null>(null)

  const showToast = (text: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage({ text, tone })
    setTimeout(() => {
      setToastMessage(null)
    }, 4500)
  }

  // Active modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [viewingDriverId, setViewingDriverId] = useState<number | null>(null)
  const [statusDriver, setStatusDriver] = useState<Driver | null>(null)
  const [assigningDriver, setAssigningDriver] = useState<Driver | null>(null)

  const queryParams: DriverQueryParams = useMemo(
    () => ({
      page,
      limit,
      search: activeSearch,
    }),
    [page, limit, activeSearch],
  )

  const driversQuery = useQuery({
    queryKey: ['drivers', 'list', queryParams],
    queryFn: () => driversService.list(queryParams),
  })

  // Global query for KPI calculations
  const allDriversQuery = useQuery({
    queryKey: ['drivers', 'metrics-summary'],
    queryFn: () => driversService.list({ limit: 100 }),
  })

  const refreshData = () => {
    void queryClient.invalidateQueries({ queryKey: ['drivers'] })
  }

  // Metrics computation
  const metrics = useMemo(() => {
    const list = allDriversQuery.data?.data.drivers ?? []
    const total = allDriversQuery.data?.data.pagination.total ?? list.length
    const active = list.filter((d) => d.status === 'ACTIVE').length
    const suspended = list.filter((d) => d.status === 'SUSPENDED').length
    const inactive = list.filter((d) => d.status === 'INACTIVE').length
    const expiringSoon = list.filter((d) => {
      const days = daysUntilExpiry(d.driverProfile?.licenceExpiry)
      return days !== null && days <= 30 && days >= 0
    }).length

    return { total, active, suspended, inactive, expiringSoon }
  }, [allDriversQuery.data])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setActiveSearch(searchInput.trim())
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setActiveSearch('')
    setStatusFilter('ALL')
    setPage(1)
  }

  // Filter by status on client if needed (backend returns all drivers matching search)
  const drivers = useMemo(() => {
    const raw = driversQuery.data?.data.drivers ?? []
    if (statusFilter === 'ALL') return raw
    return raw.filter((d) => d.status === statusFilter)
  }, [driversQuery.data, statusFilter])

  const pagination = driversQuery.data?.data.pagination
  const hasActiveFilters = Boolean(activeSearch || statusFilter !== 'ALL')

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Fleet Drivers"
        description="Register and manage certified drivers, commercial licence compliance, and operational vehicle assignments."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={refreshData}
              disabled={driversQuery.isFetching}
              title="Refresh driver list"
            >
              <RefreshCw
                size={16}
                className={cn(driversQuery.isFetching && 'animate-spin text-brand-400')}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              onClick={() => setIsRegisterOpen(true)}
              className="gap-2"
            >
              <Plus size={18} />
              Register driver
            </Button>
          </div>
        }
      />

      {/* Toast Feedback */}
      {toastMessage && (
        <Notice tone={toastMessage.tone} className="animate-in fade-in slide-in-from-top-2">
          {toastMessage.text}
        </Notice>
      )}

      {/* Driver KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Total Drivers</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-400">
              <Users size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            {metrics.total}
          </p>
          <p className="mt-1 text-xs text-ink-500">Registered driver accounts</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Active / On Duty</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-success-50 text-success-500">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-success-500 sm:text-3xl">
            {metrics.active}
          </p>
          <p className="mt-1 text-xs text-ink-500">Authorized for trip dispatch</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Suspended</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-danger-50 text-danger-500">
              <AlertOctagon size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-danger-500 sm:text-3xl">
            {metrics.suspended}
          </p>
          <p className="mt-1 text-xs text-ink-500">Accounts blocked / revoked</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Inactive / Off Duty</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-500">
              <ShieldOff size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink-700 sm:text-3xl">
            {metrics.inactive}
          </p>
          <p className="mt-1 text-xs text-ink-500">Temporarily unavailable</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Licences Expiring</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-warning-50 text-warning-400">
              <AlertTriangle size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-warning-400 sm:text-3xl">
            {metrics.expiringSoon}
          </p>
          <p className="mt-1 text-xs text-ink-500">Due within 30 days</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-ink-100 pb-3 lg:border-b-0 lg:pb-0">
            {(['ALL', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] as const).map((status) => {
              const isSelected = statusFilter === status
              return (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status)
                    setPage(1)
                  }}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-bold transition',
                    isSelected
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'text-ink-500 hover:bg-ink-100 hover:text-ink-700',
                  )}
                >
                  {status === 'ALL'
                    ? 'All Drivers'
                    : status === 'ACTIVE'
                    ? 'Active'
                    : status === 'INACTIVE'
                    ? 'Inactive'
                    : 'Suspended'}
                </button>
              )
            })}
          </div>

          {/* Search Input and Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <form onSubmit={handleSearchSubmit} className="relative min-w-[200px] flex-1 sm:w-64">
              <Search className="absolute left-3 top-3 text-ink-500" size={16} />
              <TextField
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email, licence..."
                className="h-9 pl-9 pr-8 text-xs"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('')
                    setActiveSearch('')
                    setPage(1)
                  }}
                  className="absolute right-2.5 top-2.5 text-ink-500 hover:text-ink-900"
                >
                  <X size={14} />
                </button>
              )}
            </form>

            {/* Per-page Limit */}
            <div className="w-24">
              <SelectField
                className="h-9 text-xs"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value))
                  setPage(1)
                }}
              >
                <option value="10">10 / page</option>
                <option value="20">20 / page</option>
                <option value="50">50 / page</option>
              </SelectField>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-9 text-xs text-brand-400 hover:text-brand-500"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Table Area */}
      {driversQuery.isLoading && (
        <Card className="grid min-h-64 place-items-center">
          <LoaderCircle className="animate-spin text-brand-400" size={32} />
        </Card>
      )}

      {driversQuery.isError && (
        <ErrorState
          title="Could not load drivers"
          message={apiMessage(driversQuery.error)}
          action={
            <Button size="sm" onClick={() => void driversQuery.refetch()}>
              Try again
            </Button>
          }
        />
      )}

      {driversQuery.data && drivers.length === 0 && (
        <EmptyState
          title="No drivers found"
          message={
            hasActiveFilters
              ? 'No drivers match your current search or filter criteria.'
              : 'No drivers are registered in the system yet. Click below to register the first driver.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIsRegisterOpen(true)}>
                <Plus size={16} /> Register driver
              </Button>
            )
          }
        />
      )}

      {driversQuery.data && drivers.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-950 text-xs font-bold uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-5 py-3.5">Driver & Contact</th>
                  <th className="px-4 py-3.5">Commercial Licence</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Assigned Vehicle</th>
                  <th className="px-4 py-3.5">Registered</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {drivers.map((d) => {
                  const daysLeft = daysUntilExpiry(d.driverProfile?.licenceExpiry)
                  const isExpiringSoon = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0
                  const isExpired = daysLeft !== null && daysLeft < 0

                  return (
                    <tr
                      key={d.id}
                      className="group transition hover:bg-ink-100/30"
                    >
                      {/* Driver info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-bold text-brand-400">
                            {initials(d.fullName)}
                          </span>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setViewingDriverId(d.id)}
                              className="font-bold text-ink-900 hover:text-brand-400 text-left truncate block"
                            >
                              {d.fullName}
                            </button>
                            <p className="text-xs text-ink-500 truncate">{d.email}</p>
                            {d.phoneNumber && (
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                                <Phone size={11} /> {d.phoneNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Licence Info */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider text-ink-900">
                          <CreditCard size={14} className="text-ink-500" />
                          <span>{d.driverProfile?.licenceNumber || '—'}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-ink-500">
                            Exp: {formatDate(d.driverProfile?.licenceExpiry)}
                          </span>
                          {isExpired && (
                            <span className="rounded bg-danger-50 px-1.5 py-0.5 text-[10px] font-bold text-danger-600">
                              Expired
                            </span>
                          )}
                          {isExpiringSoon && (
                            <span className="rounded bg-warning-50 px-1.5 py-0.5 text-[10px] font-bold text-warning-400">
                              {daysLeft}d left
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setStatusDriver(d)}
                          title="Click to change driver status"
                          className="focus:outline-none"
                        >
                          <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                        </button>
                      </td>

                      {/* Vehicle assignment */}
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setAssigningDriver(d)}
                          className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium"
                        >
                          <Bus size={13} />
                          Assign vehicle
                        </button>
                      </td>

                      {/* Registered Date */}
                      <td className="px-4 py-4 text-xs text-ink-500">
                        {formatDate(d.createdAt)}
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingDriverId(d.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-brand-400 transition"
                            title="View driver details"
                            aria-label={`View details for ${d.fullName}`}
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingDriver(d)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition"
                            title="Edit driver"
                            aria-label={`Edit ${d.fullName}`}
                          >
                            <Edit size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setStatusDriver(d)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition"
                            title="Change status"
                            aria-label={`Change status for ${d.fullName}`}
                          >
                            <ShieldCheck size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setAssigningDriver(d)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition"
                            title="Vehicle assignment"
                            aria-label={`Manage vehicle assignment for ${d.fullName}`}
                          >
                            <Bus size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 px-5 py-4 sm:flex-row">
              <p className="text-xs text-ink-500">
                Showing{' '}
                <span className="font-semibold text-ink-700">
                  {(pagination.page - 1) * pagination.limit + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-ink-700">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                of <span className="font-semibold text-ink-700">{pagination.total}</span> drivers
              </p>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="px-2 text-xs font-semibold text-ink-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* MODALS */}
      {/* 1. Register Driver Modal */}
      <RegisterDriverModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={(newDriver) => {
          refreshData()
          showToast(`Driver ${newDriver.fullName} registered successfully!`)
        }}
      />

      {/* 2. Edit Driver Modal */}
      <EditDriverModal
        isOpen={!!editingDriver}
        onClose={() => setEditingDriver(null)}
        driver={editingDriver}
        onSuccess={(updated) => {
          refreshData()
          showToast(`Driver ${updated.fullName} updated successfully!`)
        }}
      />

      {/* 3. Change Status Modal */}
      <ChangeDriverStatusModal
        isOpen={!!statusDriver}
        onClose={() => setStatusDriver(null)}
        driver={statusDriver}
        onSuccess={(updated) => {
          refreshData()
          showToast(`Driver ${updated.fullName} status updated to ${updated.status}.`)
        }}
      />

      {/* 4. Assign Vehicle Modal */}
      <AssignVehicleToDriverModal
        isOpen={!!assigningDriver}
        onClose={() => setAssigningDriver(null)}
        driver={assigningDriver}
        onSuccess={() => {
          refreshData()
          showToast('Vehicle assignment updated successfully!')
        }}
      />

      {/* 5. Driver Details Modal */}
      <DriverDetailsModal
        isOpen={!!viewingDriverId}
        onClose={() => setViewingDriverId(null)}
        driverId={viewingDriverId}
        onEdit={(d) => {
          setViewingDriverId(null)
          setEditingDriver(d)
        }}
        onChangeStatus={(d) => {
          setViewingDriverId(null)
          setStatusDriver(d)
        }}
        onAssignVehicle={(d) => {
          setViewingDriverId(null)
          setAssigningDriver(d)
        }}
      />
    </div>
  )
}
