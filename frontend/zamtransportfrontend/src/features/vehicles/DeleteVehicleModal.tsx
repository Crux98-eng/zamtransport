import { useState } from 'react'
import { Trash2, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { vehiclesService } from '@/services/vehicles'
import { apiError } from '@/services/api'
import type { Vehicle, VehicleListItem, VehicleDetail } from '@/types/vehicles'

export function DeleteVehicleModal({
  isOpen,
  onClose,
  vehicle,
  onDeleted,
  onDeactivated,
}: {
  isOpen: boolean
  onClose: () => void
  vehicle: Vehicle | VehicleListItem | VehicleDetail | null
  onDeleted: () => void
  onDeactivated: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [hasHistoryConflict, setHasHistoryConflict] = useState(false)

  const handleClose = () => {
    setServerError(null)
    setHasHistoryConflict(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!vehicle) return
    setIsDeleting(true)
    setServerError(null)
    setHasHistoryConflict(false)

    try {
      await vehiclesService.delete(vehicle.id)
      onDeleted()
      handleClose()
    } catch (err) {
      const errorObj = apiError(err)
      setServerError(errorObj.message)
      if (
        errorObj.code === 'HISTORICAL_RECORDS_EXIST' ||
        errorObj.status === 409 ||
        errorObj.message?.toLowerCase().includes('historical') ||
        errorObj.message?.toLowerCase().includes('deactivate')
      ) {
        setHasHistoryConflict(true)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeactivate = async () => {
    if (!vehicle) return
    setIsDeactivating(true)
    setServerError(null)

    try {
      await vehiclesService.updateStatus(vehicle.id, 'INACTIVE')
      onDeactivated()
      handleClose()
    } catch (err) {
      setServerError(apiError(err).message)
    } finally {
      setIsDeactivating(false)
    }
  }

  if (!vehicle) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Delete Vehicle · ${vehicle.registrationNumber}`}
      description="Permanent removal from the fleet directory."
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          {hasHistoryConflict ? (
            <Button
              type="button"
              variant="secondary"
              className="text-warning-400 hover:text-warning-500"
              onClick={handleDeactivate}
              disabled={isDeactivating}
            >
              <ShieldAlert size={16} />
              {isDeactivating ? 'Deactivating…' : 'Deactivate vehicle instead'}
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isDeleting || isDeactivating}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-danger-500 text-white hover:bg-danger-600 focus:ring-danger-500 shadow-none"
              onClick={handleDelete}
              disabled={isDeleting || isDeactivating}
            >
              <Trash2 size={16} />
              {isDeleting ? 'Deleting…' : 'Delete vehicle'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {serverError && <Notice tone="error">{serverError}</Notice>}

        <div className="flex items-start gap-3 rounded-xl border border-danger-500/20 bg-danger-50/20 p-4 text-sm text-danger-500">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-bold">Permanent fleet record deletion</p>
            <p className="mt-1 text-xs text-ink-500 leading-relaxed">
              Deleting a vehicle is only permitted when no historical records (trips, GPS tracking pings, or maintenance logs) exist in the database.
            </p>
          </div>
        </div>

        {hasHistoryConflict && (
          <div className="rounded-xl border border-warning-400/30 bg-warning-50/20 p-4 text-xs text-warning-400">
            <p className="font-bold">Recommended action: Deactivation</p>
            <p className="mt-1 text-ink-500 leading-relaxed">
              Because this vehicle has historical operations attached, the system retains it for audit compliance. Deactivating it safely withdraws it from service without breaking trip history.
            </p>
          </div>
        )}

        <p className="text-sm text-ink-700">
          Are you sure you want to delete vehicle{' '}
          <strong className="text-ink-900 font-mono">{vehicle.registrationNumber}</strong> (
          {vehicle.vehicleType} · {vehicle.capacity} seats)?
        </p>
      </div>
    </Modal>
  )
}
