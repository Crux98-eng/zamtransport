import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BusFront,
  CheckCircle2,
  Edit,
  Eye,
  LoaderCircle,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { TextField } from '@/components/forms/TextField'
import { SelectField } from '@/components/forms/SelectField'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState } from '@/components/shared/PageState'
import { vehiclesService } from '@/services/vehicles'
import { apiMessage } from '@/services/api'
import { cn } from '@/lib/utils'
import type {
  VehicleListItem,
  VehicleDetail,
  VehicleStatus,
  VehicleQueryParams,
} from '@/types/vehicles'

import { RegisterVehicleModal } from './RegisterVehicleModal'
import { EditVehicleModal } from './EditVehicleModal'
import { VehicleDetailsModal } from './VehicleDetailsModal'
import { ChangeStatusModal } from './ChangeStatusModal'
import { AssignDriverModal } from './AssignDriverModal'
import { DeleteVehicleModal } from './DeleteVehicleModal'

function statusTone(status: VehicleStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'MAINTENANCE':
      return 'warning'
    case 'INACTIVE':
    default:
      return 'neutral'
  }
}

export function VehiclesPage() {
  const queryClient = useQueryClient()

  // Query state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'ALL'>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('')

  // Toast / feedback message
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

  // Active modals state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VehicleListItem | VehicleDetail | null>(null)
  const [viewingVehicleId, setViewingVehicleId] = useState<number | null>(null)
  const [statusVehicle, setStatusVehicle] = useState<VehicleListItem | VehicleDetail | null>(null)
  const [assigningVehicle, setAssigningVehicle] = useState<VehicleListItem | VehicleDetail | null>(null)
  const [deletingVehicle, setDeletingVehicle] = useState<VehicleListItem | VehicleDetail | null>(null)

  // Query vehicles
  const queryParams: VehicleQueryParams = useMemo(
    () => ({
      page,
      limit,
      search: activeSearch,
      status: statusFilter,
      vehicleType: typeFilter,
    }),
    [page, limit, activeSearch, statusFilter, typeFilter],
  )

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'list', queryParams],
    queryFn: () => vehiclesService.list(queryParams),
  })

  // Global fleet overview for top metric cards
  const allFleetQuery = useQuery({
    queryKey: ['vehicles', 'metrics-summary'],
    queryFn: () => vehiclesService.list({ limit: 100 }),
  })

  const refreshData = () => {
    void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
  }

  // Metrics computation
  const metrics = useMemo(() => {
    const list = allFleetQuery.data?.data.vehicles ?? []
    const total = allFleetQuery.data?.data.pagination.total ?? list.length
    const active = list.filter((v) => v.status === 'ACTIVE').length
    const maintenance = list.filter((v) => v.status === 'MAINTENANCE').length
    const inactive = list.filter((v) => v.status === 'INACTIVE').length
    const totalCapacity = list.reduce((acc, v) => acc + (v.capacity || 0), 0)

    return { total, active, maintenance, inactive, totalCapacity }
  }, [allFleetQuery.data])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setActiveSearch(searchInput.trim())
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setActiveSearch('')
    setStatusFilter('ALL')
    setTypeFilter('')
    setPage(1)
  }

  const hasActiveFilters = Boolean(activeSearch || statusFilter !== 'ALL' || typeFilter)

  const vehicles = vehiclesQuery.data?.data.vehicles ?? []
  const pagination = vehiclesQuery.data?.data.pagination

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Fleet Vehicles"
        description="Register and manage fleet vehicles, capacity specifications, operational statuses, and driver assignments."
        actions={
          <div className="flex items-center gap-3">
            <RefreshButton size="sm" className="px-2 sm:px-3" onRefresh={refreshData} refreshing={vehiclesQuery.isFetching} />
            <Button
              onClick={() => setIsRegisterOpen(true)}
              className="gap-2"
            >
              <Plus size={18} />
              Register vehicle
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

      {/* Fleet KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Total Fleet</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-400">
              <BusFront size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            {metrics.total}
          </p>
          <p className="mt-1 text-xs text-ink-500">Registered transport units</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">In Service</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-success-50 text-success-500">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-success-500 sm:text-3xl">
            {metrics.active}
          </p>
          <p className="mt-1 text-xs text-ink-500">Available for trip dispatch</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">In Maintenance</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-warning-50 text-warning-400">
              <Wrench size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-warning-400 sm:text-3xl">
            {metrics.maintenance}
          </p>
          <p className="mt-1 text-xs text-ink-500">Undergoing repairs / service</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Inactive</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-500">
              <ShieldAlert size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink-700 sm:text-3xl">
            {metrics.inactive}
          </p>
          <p className="mt-1 text-xs text-ink-500">Decommissioned or idle</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Fleet Capacity</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-400">
              <Users size={18} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            {metrics.totalCapacity}
          </p>
          <p className="mt-1 text-xs text-ink-500">Total passenger seats</p>
        </Card>
      </div>

      {/* Filters and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-ink-100 pb-3 lg:border-b-0 lg:pb-0">
            {(['ALL', 'ACTIVE', 'MAINTENANCE', 'INACTIVE'] as const).map((status) => {
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
                    ? 'All Vehicles'
                    : status === 'ACTIVE'
                    ? 'Active'
                    : status === 'MAINTENANCE'
                    ? 'Maintenance'
                    : 'Inactive'}
                </button>
              )
            })}
          </div>

          {/* Search and Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5">
            <form onSubmit={handleSearchSubmit} className="relative min-w-[200px] flex-1 sm:w-64">
              <Search className="absolute left-3 top-3 text-ink-500" size={16} />
              <TextField
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search registration..."
                className="h-9 pl-9 pr-8 text-xs font-mono"
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

            {/* Vehicle Type Filter */}
            <div className="w-36">
              <SelectField
                className="h-9 text-xs"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Types</option>
                <option value="BUS">Bus</option>
                <option value="MINIBUS">Minibus</option>
                <option value="COACH">Coach</option>
                <option value="VAN">Van</option>
                <option value="SHUTTLE">Shuttle</option>
              </SelectField>
            </div>

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

      {/* Main Content Area */}
      {vehiclesQuery.isLoading && (
        <Card className="grid min-h-64 place-items-center">
          <LoaderCircle className="animate-spin text-brand-400" size={32} />
        </Card>
      )}

      {vehiclesQuery.isError && (
        <ErrorState
          title="Could not load fleet vehicles"
          message={apiMessage(vehiclesQuery.error)}
          action={
            <Button size="sm" onClick={() => void vehiclesQuery.refetch()}>
              Try again
            </Button>
          }
        />
      )}

      {vehiclesQuery.data && vehicles.length === 0 && (
        <EmptyState
          title="No vehicles found"
          message={
            hasActiveFilters
              ? 'No vehicles match your active search or filter criteria.'
              : 'No vehicles are registered in the system yet. Click below to register the first vehicle.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIsRegisterOpen(true)}>
                <Plus size={16} /> Register vehicle
              </Button>
            )
          }
        />
      )}

      {vehiclesQuery.data && vehicles.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-950 text-xs font-bold uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-5 py-3.5">Registration & Vehicle</th>
                  <th className="px-4 py-3.5">Type & Model</th>
                  <th className="px-4 py-3.5">Capacity</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Assigned Driver</th>
                  <th className="px-4 py-3.5">Activity</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {vehicles.map((v) => {
                  const activeAssignment = v.assignments?.find((a) => a.endedAt === null)

                  return (
                    <tr
                      key={v.id}
                      className="group transition hover:bg-ink-100/30"
                    >
                      {/* Registration & Nickname */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setViewingVehicleId(v.id)}
                            className="font-mono text-sm font-bold tracking-wider text-ink-900 hover:text-brand-400 text-left"
                          >
                            {v.registrationNumber}
                          </button>
                        </div>
                        {v.vehicleName && (
                          <p className="mt-0.5 text-xs text-ink-500">{v.vehicleName}</p>
                        )}
                      </td>

                      {/* Type & Model */}
                      <td className="px-4 py-4">
                        <p className="font-semibold text-ink-900">{v.vehicleType}</p>
                        <p className="text-xs text-ink-500">
                          {[v.manufacturer, v.model].filter(Boolean).join(' ') ||
                            (v.manufactureYear ? `Year ${v.manufactureYear}` : '—')}
                        </p>
                      </td>

                      {/* Capacity */}
                      <td className="px-4 py-4 text-ink-700">
                        <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-ink-500" />
                          <span className="font-semibold">{v.capacity}</span>
                          <span className="text-xs text-ink-500">seats</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setStatusVehicle(v)}
                          title="Click to change status"
                          className="group/btn inline-flex items-center gap-1 focus:outline-none"
                        >
                          <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                        </button>
                      </td>

                      {/* Assigned Driver */}
                      <td className="px-4 py-4">
                        {activeAssignment ? (
                          <div className="flex items-center gap-2">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-success-50 text-success-500 text-[10px] font-bold">
                              <UserCheck size={13} />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-xs text-ink-900">
                                {activeAssignment.driver.fullName}
                              </p>
                              <p className="truncate text-[11px] text-ink-500">
                                {activeAssignment.driver.email}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAssigningVehicle(v)}
                            className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-500 font-medium"
                          >
                            <UserPlus size={13} />
                            Assign driver
                          </button>
                        )}
                      </td>

                      {/* Activity Count */}
                      <td className="px-4 py-4 text-xs text-ink-500">
                        <div className="flex items-center gap-3">
                          <span title={`${v._count?.trips ?? 0} trips logged`}>
                            {v._count?.trips ?? 0} trips
                          </span>
                          <span className="text-ink-500/40">·</span>
                          <span
                            title={`${v._count?.maintenanceRecords ?? 0} maintenance records`}
                            className={cn(
                              (v._count?.maintenanceRecords ?? 0) > 0 && 'text-warning-400 font-semibold',
                            )}
                          >
                            {v._count?.maintenanceRecords ?? 0} maint
                          </span>
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingVehicleId(v.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-brand-400 transition"
                            title="View vehicle details"
                            aria-label={`View details for ${v.registrationNumber}`}
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingVehicle(v)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition"
                            title="Edit vehicle"
                            aria-label={`Edit ${v.registrationNumber}`}
                          >
                            <Edit size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setStatusVehicle(v)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition"
                            title="Change status"
                            aria-label={`Change status for ${v.registrationNumber}`}
                          >
                            <ShieldCheck size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setAssigningVehicle(v)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition"
                            title="Driver assignment"
                            aria-label={`Manage driver assignment for ${v.registrationNumber}`}
                          >
                            <UserCheck size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingVehicle(v)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-danger-50 hover:text-danger-500 transition"
                            title="Delete vehicle"
                            aria-label={`Delete ${v.registrationNumber}`}
                          >
                            <Trash2 size={16} />
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
                of <span className="font-semibold text-ink-700">{pagination.total}</span> vehicles
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
      {/* 1. Register Modal */}
      <RegisterVehicleModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={(newVehicle) => {
          refreshData()
          showToast(`Vehicle ${newVehicle.registrationNumber} registered successfully!`)
        }}
      />

      {/* 2. Edit Modal */}
      <EditVehicleModal
        isOpen={!!editingVehicle}
        onClose={() => setEditingVehicle(null)}
        vehicle={editingVehicle}
        onSuccess={(updated) => {
          refreshData()
          showToast(`Vehicle ${updated.registrationNumber} updated successfully!`)
        }}
      />

      {/* 3. Status Modal */}
      <ChangeStatusModal
        isOpen={!!statusVehicle}
        onClose={() => setStatusVehicle(null)}
        vehicle={statusVehicle}
        onSuccess={(updated) => {
          refreshData()
          showToast(`Vehicle ${updated.registrationNumber} status changed to ${updated.status}.`)
        }}
      />

      {/* 4. Assign Driver Modal */}
      <AssignDriverModal
        isOpen={!!assigningVehicle}
        onClose={() => setAssigningVehicle(null)}
        vehicle={assigningVehicle}
        onSuccess={() => {
          refreshData()
          showToast('Driver assignment updated successfully!')
        }}
      />

      {/* 5. Delete Vehicle Modal */}
      <DeleteVehicleModal
        isOpen={!!deletingVehicle}
        onClose={() => setDeletingVehicle(null)}
        vehicle={deletingVehicle}
        onDeleted={() => {
          refreshData()
          showToast('Vehicle deleted successfully.')
        }}
        onDeactivated={() => {
          refreshData()
          showToast('Vehicle has been deactivated.')
        }}
      />

      {/* 6. Vehicle Details Modal */}
      <VehicleDetailsModal
        isOpen={!!viewingVehicleId}
        onClose={() => setViewingVehicleId(null)}
        vehicleId={viewingVehicleId}
        onEdit={(v) => {
          setViewingVehicleId(null)
          setEditingVehicle(v)
        }}
        onChangeStatus={(v) => {
          setViewingVehicleId(null)
          setStatusVehicle(v)
        }}
        onAssignDriver={(v) => {
          setViewingVehicleId(null)
          setAssigningVehicle(v)
        }}
        onDelete={(v) => {
          setViewingVehicleId(null)
          setDeletingVehicle(v)
        }}
      />
    </div>
  )
}
