import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BusFront,
  Edit,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  Wrench,
  Route as RouteIcon,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { vehiclesService } from '@/services/vehicles'
import { apiMessage } from '@/services/api'
import { cn } from '@/lib/utils'
import type { VehicleDetail, VehicleStatus } from '@/types/vehicles'

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

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function VehicleDetailsModal({
  isOpen,
  onClose,
  vehicleId,
  onEdit,
  onChangeStatus,
  onAssignDriver,
  onDelete,
}: {
  isOpen: boolean
  onClose: () => void
  vehicleId: number | null
  onEdit: (vehicle: VehicleDetail) => void
  onChangeStatus: (vehicle: VehicleDetail) => void
  onAssignDriver: (vehicle: VehicleDetail) => void
  onDelete: (vehicle: VehicleDetail) => void
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'assignments' | 'trips' | 'maintenance'>(
    'overview',
  )

  const detailQuery = useQuery({
    queryKey: ['vehicles', 'detail', vehicleId],
    queryFn: () => (vehicleId ? vehiclesService.get(vehicleId) : Promise.reject('No ID')),
    enabled: isOpen && !!vehicleId,
  })

  if (!isOpen || !vehicleId) return null

  const vehicle = detailQuery.data?.data.vehicle
  const activeAssignment = vehicle?.assignments?.find((a) => a.endedAt === null)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span className="font-mono text-xl tracking-wider uppercase text-ink-900">
            {vehicle?.registrationNumber ?? 'Vehicle details'}
          </span>
          {vehicle && <Badge tone={statusTone(vehicle.status)}>{vehicle.status}</Badge>}
        </div>
      }
      description={
        vehicle
          ? `${vehicle.vehicleType} · ${vehicle.capacity} passenger seats${
              vehicle.vehicleName ? ` · "${vehicle.vehicleName}"` : ''
            }`
          : 'Loading vehicle details…'
      }
      size="2xl"
      footer={
        vehicle ? (
          <div className="flex items-center justify-between w-full">
            <Button
              type="button"
              variant="secondary"
              className="text-danger-500 hover:text-danger-600 hover:bg-danger-50"
              onClick={() => onDelete(vehicle)}
            >
              <Trash2 size={16} />
              Delete vehicle
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onChangeStatus(vehicle)}
              >
                <ShieldCheck size={16} />
                Change status
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onAssignDriver(vehicle)}
              >
                <UserCheck size={16} />
                {activeAssignment ? 'Driver assignment' : 'Assign driver'}
              </Button>
              <Button
                type="button"
                onClick={() => onEdit(vehicle)}
              >
                <Edit size={16} />
                Edit vehicle
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      {detailQuery.isLoading && (
        <div className="grid min-h-64 place-items-center">
          <LoaderCircle className="animate-spin text-brand-400" size={32} />
        </div>
      )}

      {detailQuery.isError && (
        <div className="p-6 text-center text-sm text-danger-500">
          {apiMessage(detailQuery.error)}
        </div>
      )}

      {vehicle && (
        <div className="space-y-6">
          {/* Navigation Tabs */}
          <div className="flex border-b border-ink-100 text-sm">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 font-semibold transition',
                activeTab === 'overview'
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-ink-500 hover:text-ink-700',
              )}
            >
              <BusFront size={16} />
              Specifications & Info
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 font-semibold transition',
                activeTab === 'assignments'
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-ink-500 hover:text-ink-700',
              )}
            >
              <Users size={16} />
              Driver assignments ({vehicle.assignments?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('trips')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 font-semibold transition',
                activeTab === 'trips'
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-ink-500 hover:text-ink-700',
              )}
            >
              <RouteIcon size={16} />
              Recent trips ({vehicle.trips?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 font-semibold transition',
                activeTab === 'maintenance'
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-ink-500 hover:text-ink-700',
              )}
            >
              <Wrench size={16} />
              Maintenance ({vehicle.maintenanceRecords?.length ?? 0})
            </button>
          </div>

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Active Driver Card */}
              <div className="rounded-xl border border-ink-100 bg-ink-950/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'grid h-10 w-10 place-items-center rounded-xl font-bold',
                        activeAssignment ? 'bg-success-50 text-success-500' : 'bg-ink-100 text-ink-500',
                      )}
                    >
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
                        Standing Assigned Driver
                      </p>
                      {activeAssignment ? (
                        <p className="font-bold text-ink-900">
                          {activeAssignment.driver.fullName} ({activeAssignment.driver.email})
                        </p>
                      ) : (
                        <p className="text-sm text-ink-500">No driver currently assigned</p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onAssignDriver(vehicle)}
                  >
                    {activeAssignment ? 'Change assignment' : 'Assign driver'}
                  </Button>
                </div>
              </div>

              {/* Spec Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="p-4">
                  <p className="text-xs font-semibold text-ink-500 uppercase">Registration</p>
                  <p className="mt-1 font-mono text-lg font-bold text-ink-900 tracking-wider">
                    {vehicle.registrationNumber}
                  </p>
                </Card>

                <Card className="p-4">
                  <p className="text-xs font-semibold text-ink-500 uppercase">Vehicle Type</p>
                  <p className="mt-1 text-base font-bold text-ink-900">{vehicle.vehicleType}</p>
                </Card>

                <Card className="p-4">
                  <p className="text-xs font-semibold text-ink-500 uppercase">Seating Capacity</p>
                  <p className="mt-1 text-base font-bold text-ink-900">
                    {vehicle.capacity} passengers
                  </p>
                </Card>

                <Card className="p-4">
                  <p className="text-xs font-semibold text-ink-500 uppercase">Make & Model</p>
                  <p className="mt-1 text-base font-bold text-ink-900">
                    {[vehicle.manufacturer, vehicle.model].filter(Boolean).join(' ') || '—'}
                  </p>
                </Card>

                <Card className="p-4">
                  <p className="text-xs font-semibold text-ink-500 uppercase">Year of Manufacture</p>
                  <p className="mt-1 text-base font-bold text-ink-900">
                    {vehicle.manufactureYear || '—'}
                  </p>
                </Card>

                <Card className="p-4">
                  <p className="text-xs font-semibold text-ink-500 uppercase">Fleet Nickname</p>
                  <p className="mt-1 text-base font-bold text-ink-900">
                    {vehicle.vehicleName || '—'}
                  </p>
                </Card>
              </div>

              {/* Description */}
              {vehicle.description && (
                <div className="rounded-xl border border-ink-100 bg-ink-950/30 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
                    Operational Notes / Description
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-700 whitespace-pre-wrap">
                    {vehicle.description}
                  </p>
                </div>
              )}

              {/* Audit Meta */}
              <div className="flex flex-wrap gap-6 text-xs text-ink-500">
                <span>Registered: {formatDate(vehicle.createdAt)}</span>
                <span>Last updated: {formatDate(vehicle.updatedAt)}</span>
              </div>
            </div>
          )}

          {/* TAB: ASSIGNMENTS */}
          {activeTab === 'assignments' && (
            <div className="space-y-4">
              {!vehicle.assignments || vehicle.assignments.length === 0 ? (
                <p className="p-8 text-center text-sm text-ink-500">
                  No driver assignment records on file for this vehicle.
                </p>
              ) : (
                <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 overflow-hidden">
                  {vehicle.assignments.map((assignment) => {
                    const isActive = !assignment.endedAt
                    return (
                      <div
                        key={assignment.id}
                        className={cn(
                          'flex items-center justify-between p-4 text-sm',
                          isActive ? 'bg-success-50/10' : 'bg-ink-50',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'grid h-8 w-8 place-items-center rounded-lg font-bold text-xs',
                              isActive ? 'bg-success-50 text-success-500' : 'bg-ink-100 text-ink-500',
                            )}
                          >
                            <UserCheck size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-ink-900">{assignment.driver.fullName}</p>
                            <p className="text-xs text-ink-500">{assignment.driver.email}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <Badge tone={isActive ? 'success' : 'neutral'}>
                            {isActive ? 'Active Assignment' : 'Ended'}
                          </Badge>
                          <p className="mt-1 text-xs text-ink-500">
                            From: {formatDate(assignment.assignedAt)}
                          </p>
                          {assignment.endedAt && (
                            <p className="text-xs text-ink-500">
                              Ended: {formatDate(assignment.endedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: TRIPS */}
          {activeTab === 'trips' && (
            <div className="space-y-4">
              {!vehicle.trips || vehicle.trips.length === 0 ? (
                <p className="p-8 text-center text-sm text-ink-500">
                  No recent trips logged for this vehicle.
                </p>
              ) : (
                <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 overflow-hidden">
                  {vehicle.trips.map((trip) => (
                    <div
                      key={trip.id}
                      className="flex items-center justify-between p-4 text-sm bg-ink-50 hover:bg-ink-100/50 transition"
                    >
                      <div>
                        <p className="font-bold text-ink-900 font-mono">{trip.tripCode}</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          Departs: {formatDate(trip.scheduledDeparture)}
                        </p>
                      </div>
                      <Badge
                        tone={
                          trip.status === 'COMPLETED'
                            ? 'success'
                            : trip.status === 'IN_PROGRESS'
                            ? 'info'
                            : trip.status === 'DELAYED'
                            ? 'warning'
                            : trip.status === 'CANCELLED'
                            ? 'danger'
                            : 'neutral'
                        }
                      >
                        {trip.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: MAINTENANCE */}
          {activeTab === 'maintenance' && (
            <div className="space-y-4">
              {!vehicle.maintenanceRecords || vehicle.maintenanceRecords.length === 0 ? (
                <p className="p-8 text-center text-sm text-ink-500">
                  No maintenance records recorded for this vehicle.
                </p>
              ) : (
                <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 overflow-hidden">
                  {vehicle.maintenanceRecords.map((record) => (
                    <div key={record.id} className="p-4 text-sm bg-ink-50">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-ink-900">{record.maintenanceType}</p>
                        <span className="text-xs text-ink-500">
                          {formatDate(record.maintenanceDate)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-500 leading-relaxed">
                        {record.description}
                      </p>
                      {record.cost && (
                        <p className="mt-2 text-xs font-semibold text-brand-400">
                          Cost: ZMW {Number(record.cost).toFixed(2)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
