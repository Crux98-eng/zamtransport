import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserRound, Phone, CreditCard, Calendar, MapPin } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { driversService } from '@/services/drivers'
import { apiError } from '@/services/api'
import { driverUpdateSchema, type DriverUpdateFormValues } from './driverSchema'
import type { Driver } from '@/types/drivers'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-danger-600 font-medium">{message}</p>
}

export function EditDriverModal({
  isOpen,
  onClose,
  driver,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  driver: Driver | null
  onSuccess: (driver: Driver) => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)

  const expiryDateString = driver?.driverProfile?.licenceExpiry
    ? new Date(driver.driverProfile.licenceExpiry).toISOString().split('T')[0]
    : ''

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DriverUpdateFormValues>({
    resolver: zodResolver(driverUpdateSchema),
    values: driver
      ? {
          fullName: driver.fullName,
          phoneNumber: driver.phoneNumber ?? '',
          address: driver.driverProfile?.address ?? '',
          licenceNumber: driver.driverProfile?.licenceNumber ?? '',
          licenceExpiry: expiryDateString,
        }
      : undefined,
  })

  const handleClose = () => {
    setServerError(null)
    onClose()
  }

  const onSubmit = async (values: DriverUpdateFormValues) => {
    if (!driver) return
    setServerError(null)
    try {
      const res = await driversService.update(driver.id, {
        fullName: values.fullName.trim(),
        phoneNumber: values.phoneNumber?.trim() || null,
        address: values.address?.trim() || null,
        licenceNumber: values.licenceNumber.trim().toUpperCase(),
        licenceExpiry: new Date(`${values.licenceExpiry}T23:59:59.999Z`).toISOString(),
      })

      onSuccess(res.data.driver)
      handleClose()
    } catch (err) {
      setServerError(apiError(err).message)
    }
  }

  if (!driver) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Edit Driver · ${driver.fullName}`}
      description="Update profile details, contact information, or commercial licence credentials."
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-driver-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving changes…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form
        id="edit-driver-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        {serverError && <Notice tone="error">{serverError}</Notice>}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Full Name */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-ink-700">
              Full name <span className="text-brand-400">*</span>
              <div className="relative mt-1.5">
                <UserRound className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField className="pl-10" {...register('fullName')} />
              </div>
              <FieldError message={errors.fullName?.message} />
            </label>
          </div>

          {/* Phone */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-ink-700">
              Phone number <span className="font-normal text-ink-500">(optional)</span>
              <div className="relative mt-1.5">
                <Phone className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField className="pl-10" type="tel" {...register('phoneNumber')} />
              </div>
              <FieldError message={errors.phoneNumber?.message} />
            </label>
          </div>

          {/* Licence Number */}
          <div>
            <label className="block text-sm font-semibold text-ink-700">
              Licence number <span className="text-brand-400">*</span>
              <div className="relative mt-1.5">
                <CreditCard className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField
                  className="pl-10 font-mono uppercase tracking-wider"
                  {...register('licenceNumber')}
                />
              </div>
              <FieldError message={errors.licenceNumber?.message} />
            </label>
          </div>

          {/* Licence Expiry */}
          <div>
            <label className="block text-sm font-semibold text-ink-700">
              Licence expiry date <span className="text-brand-400">*</span>
              <div className="relative mt-1.5">
                <Calendar className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField className="pl-10" type="date" {...register('licenceExpiry')} />
              </div>
              <FieldError message={errors.licenceExpiry?.message} />
            </label>
          </div>

          {/* Address */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-ink-700">
              Depot / Residential address <span className="font-normal text-ink-500">(optional)</span>
              <div className="relative mt-1.5">
                <MapPin className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField className="pl-10" {...register('address')} />
              </div>
              <FieldError message={errors.address?.message} />
            </label>
          </div>
        </div>
      </form>
    </Modal>
  )
}
