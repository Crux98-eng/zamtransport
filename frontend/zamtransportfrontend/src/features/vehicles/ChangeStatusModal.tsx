import { useState } from 'react'
import { CheckCircle2, Wrench, ShieldAlert, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { vehiclesService } from '@/services/vehicles'
import { apiError } from '@/services/api'
import { cn } from '@/lib/utils'
import type { Vehicle, VehicleListItem, VehicleDetail, VehicleStatus } from '@/types/vehicles'

const STATUS_OPTIONS: Array<{
  status: VehicleStatus
  title: string
  description: string
  icon: typeof CheckCircle2
  activeClass: string
  badgeClass: string
}> = [
  {
    status: 'ACTIVE',
    title: 'Active in Service',
    description: 'Vehicle is certified and available for operational trips and driver assignments.',
    icon: CheckCircle2,
    activeClass: 'border-success-500 bg-success-50/20 text-success-500',
    badgeClass: 'bg-success-50 text-success-600',
  },
  {
    status: 'MAINTENANCE',
    title: 'In Maintenance',
    description: 'Vehicle is undergoing servicing, repair, or inspection. Excluded from trip dispatch.',
    icon: Wrench,
    activeClass: 'border-warning-400 bg-warning-50/20 text-warning-400',
    badgeClass: 'bg-warning-50 text-warning-400',
  },
  {
    status: 'INACTIVE',
    title: 'Decommissioned / Inactive',
    description: 'Vehicle is suspended from operation or retired from the active fleet.',
    icon: ShieldAlert,
    activeClass: 'border-danger-500 bg-danger-50/20 text-danger-500',
    badgeClass: 'bg-danger-50 text-danger-600',
  },
]

export function ChangeStatusModal({
  isOpen,
  onClose,
  vehicle,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  vehicle: Vehicle | VehicleListItem | VehicleDetail | null
  onSuccess: (updatedVehicle: Vehicle) => void
}) {
  const [selectedStatus, setSelectedStatus] = useState<VehicleStatus>(vehicle?.status ?? 'ACTIVE')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Sync state when vehicle changes
  if (vehicle && selectedStatus !== vehicle.status && !isSubmitting && !serverError) {
    // Only adjust initial selection if modal reopened with different vehicle
  }

  const handleClose = () => {
    setServerError(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!vehicle) return
    setIsSubmitting(true)
    setServerError(null)
    try {
      const res = await vehiclesService.updateStatus(vehicle.id, selectedStatus)
      onSuccess(res.data.vehicle)
      handleClose()
    } catch (err) {
      setServerError(apiError(err).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!vehicle) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Update Vehicle Status · ${vehicle.registrationNumber}`}
      description="Change operational availability for trip dispatch and monitoring."
      size="md"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedStatus === vehicle.status}
          >
            {isSubmitting ? 'Updating status…' : 'Apply status change'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {serverError && <Notice tone="error">{serverError}</Notice>}

        {vehicle.status === 'ACTIVE' && selectedStatus === 'MAINTENANCE' && (
          <div className="flex gap-2 rounded-lg bg-warning-50 p-3 text-xs text-warning-400">
            <AlertTriangle className="shrink-0" size={16} />
            <p>Moving this vehicle to Maintenance will flag it as unavailable for upcoming trip generation.</p>
          </div>
        )}

        <div className="space-y-3">
          {STATUS_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isSelected = selectedStatus === opt.status
            const isCurrent = vehicle.status === opt.status

            return (
              <button
                key={opt.status}
                type="button"
                onClick={() => setSelectedStatus(opt.status)}
                className={cn(
                  'flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition',
                  isSelected
                    ? `${opt.activeClass} border-2`
                    : 'border-ink-100 bg-ink-950/40 text-ink-500 hover:border-ink-100/80 hover:bg-ink-100/30 hover:text-ink-700',
                )}
              >
                <div
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                    isSelected ? opt.badgeClass : 'bg-ink-100 text-ink-500',
                  )}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm font-bold', isSelected ? 'text-ink-900' : 'text-ink-700')}>
                      {opt.title}
                    </p>
                    {isCurrent && (
                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">
                    {opt.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
