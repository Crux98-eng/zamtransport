import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  UserRound,
  Mail,
  Phone,
  CreditCard,
  MapPin,
  ShieldCheck,
  Edit,
  LoaderCircle,
  Bus,
  Route as RouteIcon,
  AlertTriangle,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { driversService } from '@/services/drivers'
import { apiMessage } from '@/services/api'
import { cn } from '@/lib/utils'
import type { Driver, DriverStatus } from '@/types/drivers'

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
      timeStyle: 'short',
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

export function DriverDetailsModal({
  isOpen,
  onClose,
  driverId,
  onEdit,
  onChangeStatus,
  onAssignVehicle,
}: {
  isOpen: boolean
  onClose: () => void
  driverId: number | null
  onEdit: (driver: Driver) => void
  onChangeStatus: (driver: Driver) => void
  onAssignVehicle: (driver: Driver) => void
}) {
  const [activeTab, setActiveTab] = useState<'profile' | 'assignments' | 'trips'>('profile')

  const driverQuery = useQuery({
    queryKey: ['drivers', 'detail', driverId],
    queryFn: () => (driverId ? driversService.get(driverId) : Promise.reject('No ID')),
    enabled: isOpen && !!driverId,
  })

  const assignmentsQuery = useQuery({
    queryKey: ['drivers', 'assignments', driverId],
    queryFn: () => (driverId ? driversService.getAssignments(driverId) : Promise.reject('No ID')),
    enabled: isOpen && !!driverId && activeTab === 'assignments',
  })

  const tripsQuery = useQuery({
    queryKey: ['drivers', 'trips', driverId],
    queryFn: () => (driverId ? driversService.getTrips(driverId, { limit: 20 }) : Promise.reject('No ID')),
    enabled: isOpen && !!driverId && activeTab === 'trips',
  })

  if (!isOpen || !driverId) return null

  const driver = driverQuery.data?.data.driver
  const daysLeft = daysUntilExpiry(driver?.driverProfile?.licenceExpiry)
  const isExpiringSoon = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0
  const isExpired = daysLeft !== null && daysLeft < 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-ink-900">{driver?.fullName ?? 'Driver Profile'}</span>
          {driver && <Badge tone={statusTone(driver.status)}>{driver.status}</Badge>}
        </div>
      }
      description={
        driver
          ? `${driver.email}${
              driver.driverProfile?.licenceNumber
                ? ` · Licence: ${driver.driverProfile.licenceNumber}`
                : ''
            }`
          : 'Loading driver details…'
      }
      size="2xl"
      footer={
        driver ? (
          <div className="flex items-center justify-between w-full">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onChangeStatus(driver)}
            >
              <ShieldCheck size={16} />
              Change account status
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onAssignVehicle(driver)}
              >
                <Bus size={16} />
                Vehicle assignment
              </Button>
              <Button
                type="button"
                onClick={() => onEdit(driver)}
              >
                <Edit size={16} />
                Edit profile
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      {driverQuery.isLoading && (
        <div className="grid min-h-64 place-items-center">
          <LoaderCircle className="animate-spin text-brand-400" size={32} />
        </div>
      )}

      {driverQuery.isError && (
        <div className="p-6 text-center text-sm text-danger-500">
          {apiMessage(driverQuery.error)}
        </div>
      )}

      {driver && (
        <div className="space-y-6">
          {/* Navigation Tabs */}
          <div className="flex border-b border-ink-100 text-sm">
            <button
              onClick={() => setActiveTab('profile')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 font-semibold transition',
                activeTab === 'profile'
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-ink-500 hover:text-ink-700',
              )}
            >
              <UserRound size={16} />
              Profile & Licence
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
              <Bus size={16} />
              Vehicle assignments
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
              Trip history
            </button>
          </div>

          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Licence Expiry Alert if applicable */}
              {isExpired && (
                <div className="flex items-center gap-3 rounded-xl border border-danger-500/30 bg-danger-50/30 p-4 text-sm text-danger-500">
                  <AlertTriangle className="shrink-0" size={18} />
                  <div>
                    <p className="font-bold">Driving licence is expired!</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      The commercial driving licence expired on {formatDate(driver.driverProfile?.licenceExpiry)}.
                    </p>
                  </div>
                </div>
              )}

              {isExpiringSoon && (
                <div className="flex items-center gap-3 rounded-xl border border-warning-400/30 bg-warning-50/20 p-4 text-sm text-warning-400">
                  <AlertTriangle className="shrink-0" size={18} />
                  <div>
                    <p className="font-bold">Driving licence expiring soon</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      Licence expires in {daysLeft} days ({formatDate(driver.driverProfile?.licenceExpiry)}).
                    </p>
                  </div>
                </div>
              )}

              {/* Information Cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="p-4">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-ink-500 uppercase">
                    <UserRound size={15} className="text-brand-400" />
                    <span>Full Legal Name</span>
                  </div>
                  <p className="mt-1 text-base font-bold text-ink-900">{driver.fullName}</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-ink-500 uppercase">
                    <Mail size={15} className="text-brand-400" />
                    <span>Email Address</span>
                  </div>
                  <p className="mt-1 text-base font-bold text-ink-900">{driver.email}</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-ink-500 uppercase">
                    <Phone size={15} className="text-brand-400" />
                    <span>Phone Number</span>
                  </div>
                  <p className="mt-1 text-base font-bold text-ink-900">
                    {driver.phoneNumber || 'Not provided'}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-ink-500 uppercase">
                    <CreditCard size={15} className="text-brand-400" />
                    <span>Commercial Licence</span>
                  </div>
                  <p className="mt-1 font-mono text-base font-bold text-ink-900 tracking-wider">
                    {driver.driverProfile?.licenceNumber || '—'}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-ink-500 uppercase">
                    <span>Licence Expiry Date</span>
                  </div>
                  <p className="mt-1 text-base font-bold text-ink-900">
                    {formatDate(driver.driverProfile?.licenceExpiry)}
                  </p>
                  {daysLeft !== null && (
                    <p className="mt-1 text-xs text-ink-500">
                      {daysLeft < 0 ? 'Expired' : `${daysLeft} days remaining`}
                    </p>
                  )}
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-ink-500 uppercase">
                    <MapPin size={15} className="text-brand-400" />
                    <span>Depot / Address</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-ink-900">
                    {driver.driverProfile?.address || 'Not provided'}
                  </p>
                </Card>
              </div>

              {/* Audit Timestamps */}
              <div className="flex flex-wrap gap-6 text-xs text-ink-500">
                <span>Account created: {formatDate(driver.createdAt)}</span>
                {driver.approvedAt && <span>Approved: {formatDate(driver.approvedAt)}</span>}
                {driver.suspendedAt && <span>Suspended: {formatDate(driver.suspendedAt)}</span>}
              </div>
            </div>
          )}

          {/* TAB: ASSIGNMENTS */}
          {activeTab === 'assignments' && (
            <div className="space-y-4">
              {assignmentsQuery.isLoading && (
                <div className="grid min-h-40 place-items-center">
                  <LoaderCircle className="animate-spin text-brand-400" size={24} />
                </div>
              )}

              {assignmentsQuery.data && assignmentsQuery.data.data.assignments.length === 0 && (
                <p className="p-8 text-center text-sm text-ink-500">
                  No vehicle assignment history on record for this driver.
                </p>
              )}

              {assignmentsQuery.data && assignmentsQuery.data.data.assignments.length > 0 && (
                <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 overflow-hidden">
                  {assignmentsQuery.data.data.assignments.map((assignment) => {
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
                              'grid h-9 w-9 place-items-center rounded-xl font-bold',
                              isActive ? 'bg-success-50 text-success-500' : 'bg-ink-100 text-ink-500',
                            )}
                          >
                            <Bus size={18} />
                          </div>
                          <div>
                            <p className="font-mono font-bold text-ink-900 tracking-wider">
                              {assignment.vehicle?.registrationNumber ?? 'Vehicle'}
                            </p>
                            <p className="text-xs text-ink-500">
                              {assignment.vehicle?.vehicleType}
                              {assignment.vehicle?.vehicleName ? ` · ${assignment.vehicle.vehicleName}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <Badge tone={isActive ? 'success' : 'neutral'}>
                            {isActive ? 'Active Assignment' : 'Ended'}
                          </Badge>
                          <p className="mt-1 text-xs text-ink-500">
                            Assigned: {formatDate(assignment.assignedAt)}
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
              {tripsQuery.isLoading && (
                <div className="grid min-h-40 place-items-center">
                  <LoaderCircle className="animate-spin text-brand-400" size={24} />
                </div>
              )}

              {tripsQuery.data && tripsQuery.data.data.trips.length === 0 && (
                <p className="p-8 text-center text-sm text-ink-500">
                  No trips logged for this driver yet.
                </p>
              )}

              {tripsQuery.data && tripsQuery.data.data.trips.length > 0 && (
                <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 overflow-hidden">
                  {tripsQuery.data.data.trips.map((trip) => (
                    <div
                      key={trip.id}
                      className="flex items-center justify-between p-4 text-sm bg-ink-50 hover:bg-ink-100/50 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-ink-900">{trip.tripCode}</span>
                          {trip.route && (
                            <span className="text-xs text-ink-500">
                              · {trip.route.origin} → {trip.route.destination}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-500">
                          Departure: {formatDate(trip.scheduledDeparture)}
                          {trip.vehicle ? ` · Vehicle: ${trip.vehicle.registrationNumber}` : ''}
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
        </div>
      )}
    </Modal>
  )
}
