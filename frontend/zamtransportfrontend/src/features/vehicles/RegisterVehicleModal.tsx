import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BusFront, Hash, Users, Calendar, Factory } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { TextField } from '@/components/forms/TextField'
import { SelectField } from '@/components/forms/SelectField'
import { TextAreaField } from '@/components/forms/TextAreaField'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { vehiclesService } from '@/services/vehicles'
import { apiError } from '@/services/api'
import {
  vehicleFormSchema,
  sanitizeVehiclePayload,
  type VehicleFormValues,
} from './vehicleSchema'
import type { Vehicle } from '@/types/vehicles'

const COMMON_VEHICLE_TYPES = [
  { value: 'BUS', label: 'Standard Bus' },
  { value: 'MINIBUS', label: 'Minibus / HiAce' },
  { value: 'COACH', label: 'Intercity Coach' },
  { value: 'SHUTTLE', label: 'Airport / City Shuttle' },
  { value: 'VAN', label: 'Passenger Van' },
]

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-danger-600 font-medium">{message}</p>
}

export function RegisterVehicleModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: (vehicle: Vehicle) => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      registrationNumber: '',
      vehicleType: 'BUS',
      capacity: 30,
      vehicleName: '',
      manufacturer: '',
      model: '',
      manufactureYear: null,
      description: '',
    },
  })

  const handleClose = () => {
    reset()
    setServerError(null)
    onClose()
  }

  const onSubmit = async (values: VehicleFormValues) => {
    setServerError(null)
    try {
      const payload = sanitizeVehiclePayload(values)
      const res = await vehiclesService.register(payload)
      reset()
      onSuccess(res.data.vehicle)
      handleClose()
    } catch (err) {
      setServerError(apiError(err).message)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Register New Vehicle"
      description="Add a new passenger or fleet vehicle to the Zambia Transport System."
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="register-vehicle-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Registering vehicle…' : 'Register vehicle'}
          </Button>
        </>
      }
    >
      <form
        id="register-vehicle-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        {serverError && <Notice tone="error">{serverError}</Notice>}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Registration Number */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-ink-700">
              Registration number <span className="text-brand-400">*</span>
              <div className="relative mt-1.5">
                <Hash className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField
                  className="pl-10 font-mono uppercase tracking-wider"
                  placeholder="e.g. BLA 4821 or ZM-204"
                  autoFocus
                  {...register('registrationNumber')}
                />
              </div>
              <FieldError message={errors.registrationNumber?.message} />
            </label>
          </div>

          {/* Vehicle Type */}
          <div>
            <label className="block text-sm font-semibold text-ink-700">
              Vehicle type <span className="text-brand-400">*</span>
              <div className="relative mt-1.5">
                <SelectField {...register('vehicleType')}>
                  {COMMON_VEHICLE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label} ({type.value})
                    </option>
                  ))}
                  <option value="OTHER">Other / Custom</option>
                </SelectField>
              </div>
              <FieldError message={errors.vehicleType?.message} />
            </label>
          </div>

          {/* Passenger Capacity */}
          <div>
            <label className="block text-sm font-semibold text-ink-700">
              Seating capacity <span className="text-brand-400">*</span>
              <div className="relative mt-1.5">
                <Users className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField
                  className="pl-10"
                  type="number"
                  min={1}
                  max={1000}
                  placeholder="e.g. 30"
                  {...register('capacity', { valueAsNumber: true })}
                />
              </div>
              <FieldError message={errors.capacity?.message} />
            </label>
          </div>

          {/* Vehicle Name (Optional) */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-ink-700">
              Vehicle fleet nickname <span className="font-normal text-ink-500">(optional)</span>
              <div className="relative mt-1.5">
                <BusFront className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField
                  className="pl-10"
                  placeholder="e.g. Copperbelt Express #01"
                  {...register('vehicleName')}
                />
              </div>
              <FieldError message={errors.vehicleName?.message} />
            </label>
          </div>

          {/* Manufacturer */}
          <div>
            <label className="block text-sm font-semibold text-ink-700">
              Manufacturer <span className="font-normal text-ink-500">(optional)</span>
              <div className="relative mt-1.5">
                <Factory className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField
                  className="pl-10"
                  placeholder="e.g. Toyota, Scania, Isuzu"
                  {...register('manufacturer')}
                />
              </div>
              <FieldError message={errors.manufacturer?.message} />
            </label>
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-semibold text-ink-700">
              Model <span className="font-normal text-ink-500">(optional)</span>
              <div className="relative mt-1.5">
                <TextField
                  placeholder="e.g. Coaster, Marcopolo"
                  {...register('model')}
                />
              </div>
              <FieldError message={errors.model?.message} />
            </label>
          </div>

          {/* Manufacture Year */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-ink-700">
              Manufacture year <span className="font-normal text-ink-500">(optional)</span>
              <div className="relative mt-1.5">
                <Calendar className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField
                  className="pl-10"
                  type="number"
                  min={1886}
                  max={new Date().getFullYear() + 1}
                  placeholder={`e.g. ${new Date().getFullYear() - 2}`}
                  {...register('manufactureYear', {
                    setValueAs: (v) =>
                      v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v),
                  })}
                />
              </div>
              <FieldError message={errors.manufactureYear?.message} />
            </label>
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-ink-700">
              Description / Notes <span className="font-normal text-ink-500">(optional)</span>
              <div className="relative mt-1.5">
                <TextAreaField
                  rows={3}
                  placeholder="Additional vehicle details, air conditioning, accessibility features..."
                  {...register('description')}
                />
              </div>
              <FieldError message={errors.description?.message} />
            </label>
          </div>
        </div>
      </form>
    </Modal>
  )
}
