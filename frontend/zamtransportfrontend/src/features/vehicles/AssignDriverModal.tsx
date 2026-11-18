import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserCheck, UserX, AlertCircle, LoaderCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/forms/SelectField'
import { Notice } from '@/components/ui/Notice'
import { vehiclesService } from '@/services/vehicles'
import { apiError } from '@/services/api'
import type { VehicleListItem, VehicleDetail, VehicleAssignment } from '@/types/vehicles'

export function AssignDriverModal({
  isOpen,
  onClose,
  vehicle,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  vehicle: VehicleListItem | VehicleDetail | null
  onSuccess: () => void
}) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Find active assignment
  const activeAssignment: VehicleAssignment | undefined = vehicle?.assignments?.find(
    (a) => a.endedAt === null,
  )

  const driversQuery = useQuery({
    queryKey: ['admin', 'drivers', 'active-list'],
    queryFn: () => vehiclesService.listDrivers({ limit: 100 }),
    enabled: isOpen,
  })

  const activeDrivers = useMemo(() => {
    const list = driversQuery.data?.data.drivers ?? []
    return list.filter((d) => d.status === 'ACTIVE')
  }, [driversQuery.data])

  const effectiveDriverId = selectedDriverId || (activeDrivers[0] ? String(activeDrivers[0].id) : '')

  const handleClose = () => {
    setServerError(null)
    setSuccessNotice(null)
    setSelectedDriverId('')
    onClose()
  }

  const handleAssign = async () => {
    if (!vehicle || !effectiveDriverId) return
    setIsSubmitting(true)
    setServerError(null)

    try {
      await vehiclesService.assignDriver({
        vehicleId: vehicle.id,
        driverId: Number(effectiveDriverId),
      })
      setSuccessNotice('Driver assigned successfully!')
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 700)
    } catch (err) {
      setServerError(apiError(err).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEndAssignment = async () => {
    if (!activeAssignment) return
    setIsSubmitting(true)
    setServerError(null)

    try {
      await vehiclesService.endAssignment(activeAssignment.id)
      setSuccessNotice('Active driver assignment ended.')
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 700)
    } catch (err) {
      setServerError(apiError(err).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!vehicle) return null

  const isVehicleActive = vehicle.status === 'ACTIVE'
  const loadingDrivers = driversQuery.isLoading

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Driver Assignment · ${vehicle.registrationNumber}`}
      description="Manage standing vehicle-driver assignment for operational trips."
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          {activeAssignment ? (
            <Button
              type="button"
              variant="secondary"
              className="text-danger-500 hover:text-danger-600 hover:bg-danger-50"
              onClick={handleEndAssignment}
              disabled={isSubmitting}
            >
              <UserX size={16} />
              End standing assignment
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              Close
            </Button>
            {isVehicleActive && (
              <Button
                type="button"
                onClick={handleAssign}
                disabled={isSubmitting || !effectiveDriverId || loadingDrivers}
              >
                {isSubmitting ? 'Assigning…' : activeAssignment ? 'Reassign driver' : 'Assign driver'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {serverError && <Notice tone="error">{serverError}</Notice>}
        {successNotice && <Notice tone="success">{successNotice}</Notice>}

        {!isVehicleActive && (
          <div className="flex gap-2.5 rounded-xl border border-warning-400/30 bg-warning-50/20 p-4 text-sm text-warning-400">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-bold">Vehicle is currently {vehicle.status}</p>
              <p className="mt-1 text-xs text-ink-500">
                Only vehicles in ACTIVE status can receive driver assignments. Please change the vehicle status to ACTIVE first.
              </p>
            </div>
          </div>
        )}

        {/* Current Standing Assignment */}
        <div className="rounded-xl border border-ink-100 bg-ink-950/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Current assignment
          </p>
          {activeAssignment ? (
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-400 font-bold">
                  <UserCheck size={20} />
                </div>
                <div>
                  <p className="font-bold text-ink-900">{activeAssignment.driver.fullName}</p>
                  <p className="text-xs text-ink-500">{activeAssignment.driver.email}</p>
                  <p className="mt-1 text-[11px] text-ink-500">
                    Assigned on{' '}
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(activeAssignment.assignedAt))}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-sm text-ink-500">
              <span className="h-2 w-2 rounded-full bg-ink-500" />
              <span>No standing driver currently assigned to this vehicle.</span>
            </div>
          )}
        </div>

        {/* Assign new driver */}
        {isVehicleActive && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-ink-700">
              {activeAssignment ? 'Assign a different active driver' : 'Select an active driver to assign'}
              <div className="relative mt-2">
                {loadingDrivers ? (
                  <div className="flex h-11 items-center gap-2 rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-500">
                    <LoaderCircle className="animate-spin text-brand-400" size={16} />
                    <span>Loading registered drivers…</span>
                  </div>
                ) : activeDrivers.length === 0 ? (
                  <p className="text-xs text-ink-500">No active drivers available in the system.</p>
                ) : (
                  <SelectField
                    value={effectiveDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                  >
                    {activeDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.email})
                        {d.driverProfile?.licenceNumber ? ` · Licence ${d.driverProfile.licenceNumber}` : ''}
                      </option>
                    ))}
                  </SelectField>
                )}
              </div>
            </label>
            <p className="text-xs text-ink-500">
              Note: A driver and vehicle can only have one active standing assignment at a time.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
