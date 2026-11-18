import { useState } from 'react'
import { CheckCircle2, ShieldOff, AlertOctagon, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { driversService } from '@/services/drivers'
import { apiError } from '@/services/api'
import { cn } from '@/lib/utils'
import type { Driver } from '@/types/drivers'

const STATUS_OPTIONS: Array<{
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  title: string
  description: string
  icon: typeof CheckCircle2
  activeClass: string
  badgeClass: string
}> = [
  {
    status: 'ACTIVE',
    title: 'Active / Authorized',
    description: 'Driver is active and authorized for vehicle assignments and trip dispatch.',
    icon: CheckCircle2,
    activeClass: 'border-success-500 bg-success-50/20 text-success-500',
    badgeClass: 'bg-success-50 text-success-600',
  },
  {
    status: 'INACTIVE',
    title: 'Inactive / Off Duty',
    description: 'Driver is temporarily off duty or unavailable for new assignments.',
    icon: ShieldOff,
    activeClass: 'border-ink-100 bg-ink-100/30 text-ink-500',
    badgeClass: 'bg-ink-100 text-ink-500',
  },
  {
    status: 'SUSPENDED',
    title: 'Suspended Account',
    description: 'Driver is suspended. All active login sessions and tokens are immediately revoked.',
    icon: AlertOctagon,
    activeClass: 'border-danger-500 bg-danger-50/20 text-danger-500',
    badgeClass: 'bg-danger-50 text-danger-600',
  },
]

export function ChangeDriverStatusModal({
  isOpen,
  onClose,
  driver,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  driver: Driver | null
  onSuccess: (updatedDriver: Driver) => void
}) {
  const [selectedStatus, setSelectedStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>(
    (driver?.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') ?? 'ACTIVE',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const handleClose = () => {
    setServerError(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!driver) return
    setIsSubmitting(true)
    setServerError(null)
    try {
      const res = await driversService.updateStatus(driver.id, selectedStatus)
      onSuccess(res.data.driver)
      handleClose()
    } catch (err) {
      setServerError(apiError(err).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!driver) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Update Driver Status · ${driver.fullName}`}
      description="Change driver operational permissions and account authorization."
      size="md"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedStatus === driver.status}
          >
            {isSubmitting ? 'Updating status…' : 'Apply status change'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {serverError && <Notice tone="error">{serverError}</Notice>}

        {selectedStatus === 'SUSPENDED' && (
          <div className="flex gap-2 rounded-lg bg-danger-50 p-3 text-xs text-danger-600">
            <AlertTriangle className="shrink-0" size={16} />
            <p>
              Suspending this driver will immediately revoke all active refresh tokens and sign them out of mobile devices.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {STATUS_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isSelected = selectedStatus === opt.status
            const isCurrent = driver.status === opt.status

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
