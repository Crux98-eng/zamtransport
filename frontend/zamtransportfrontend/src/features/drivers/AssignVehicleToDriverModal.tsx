import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bus, UserX, AlertCircle, LoaderCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/forms/SelectField'
import { Notice } from '@/components/ui/Notice'
import { driversService } from '@/services/drivers'
import { apiError } from '@/services/api'
import type { Driver, DriverVehicleAssignment } from '@/types/drivers'

export function AssignVehicleToDriverModal({
  isOpen,
  onClose,
  driver,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  driver: Driver | null
  onSuccess: () => void
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const activeAssignment: DriverVehicleAssignment | undefined = driver?.assignments?.find(
    (a) => a.endedAt === null,
  )

  const vehiclesQuery = useQuery({
    queryKey: ['admin', 'vehicles', 'active-for-assignment'],
    queryFn: () => driversService.listVehicles({ status: 'ACTIVE', limit: 100 }),
    enabled: isOpen,
  })

  const activeVehicles = useMemo(() => {
    return vehiclesQuery.data?.data.vehicles ?? []
  }, [vehiclesQuery.data])

  const effectiveVehicleId =
    selectedVehicleId || (activeVehicles[0] ? String(activeVehicles[0].id) : '')

  const handleClose = () => {
    setServerError(null)
    setSuccessNotice(null)
    setSelectedVehicleId('')
    onClose()
  }

  const handleAssign = async () => {
    if (!driver || !effectiveVehicleId) return
    setIsSubmitting(true)
    setServerError(null)

    try {
      await driversService.assignVehicle({
        driverId: driver.id,
        vehicleId: Number(effectiveVehicleId),
      })
      setSuccessNotice('Vehicle assigned to driver successfully!')
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
      await driversService.endAssignment(activeAssignment.id)
      setSuccessNotice('Vehicle assignment ended.')
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

  if (!driver) return null

  const isDriverActive = driver.status === 'ACTIVE'
  const loadingVehicles = vehiclesQuery.isLoading

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Vehicle Assignment · ${driver.fullName}`}
      description="Manage standing vehicle assignment for this driver."
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
            {isDriverActive && (
              <Button
                type="button"
                onClick={handleAssign}
                disabled={isSubmitting || !effectiveVehicleId || loadingVehicles}
              >
                {isSubmitting ? 'Assigning…' : activeAssignment ? 'Reassign vehicle' : 'Assign vehicle'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {serverError && <Notice tone="error">{serverError}</Notice>}
        {successNotice && <Notice tone="success">{successNotice}</Notice>}

        {!isDriverActive && (
          <div className="flex gap-2.5 rounded-xl border border-warning-400/30 bg-warning-50/20 p-4 text-sm text-warning-400">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-bold">Driver is currently {driver.status}</p>
              <p className="mt-1 text-xs text-ink-500">
                Only drivers in ACTIVE status can receive vehicle assignments. Please change the driver status to ACTIVE first.
              </p>
            </div>
          </div>
        )}

        {/* Current Vehicle Assignment */}
        <div className="rounded-xl border border-ink-100 bg-ink-950/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Current assigned vehicle
          </p>
          {activeAssignment?.vehicle ? (
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-400 font-bold">
                  <Bus size={20} />
                </div>
                <div>
                  <p className="font-mono font-bold text-ink-900 tracking-wider">
                    {activeAssignment.vehicle.registrationNumber}
                  </p>
                  <p className="text-xs text-ink-500">
                    {activeAssignment.vehicle.vehicleType}
                    {activeAssignment.vehicle.vehicleName ? ` · ${activeAssignment.vehicle.vehicleName}` : ''}
                  </p>
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
              <span>No vehicle currently assigned to this driver.</span>
            </div>
          )}
        </div>

        {/* Assign new vehicle */}
        {isDriverActive && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-ink-700">
              {activeAssignment ? 'Assign a different active vehicle' : 'Select an active vehicle to assign'}
              <div className="relative mt-2">
                {loadingVehicles ? (
                  <div className="flex h-11 items-center gap-2 rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-500">
                    <LoaderCircle className="animate-spin text-brand-400" size={16} />
                    <span>Loading available fleet vehicles…</span>
                  </div>
                ) : activeVehicles.length === 0 ? (
                  <p className="text-xs text-ink-500">No active vehicles available in the fleet.</p>
                ) : (
                  <SelectField
                    value={effectiveVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                  >
                    {activeVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber} ({v.vehicleType} · {v.capacity} seats)
                        {v.vehicleName ? ` · ${v.vehicleName}` : ''}
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
