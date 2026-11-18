import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  UserRound,
  Mail,
  Phone,
  LockKeyhole,
  Eye,
  EyeOff,
  CreditCard,
  Calendar,
  MapPin,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { driversService } from '@/services/drivers'
import { apiError } from '@/services/api'
import {
  driverRegisterSchema,
  generateStrongPassword,
  type DriverRegisterFormValues,
} from './driverSchema'
import type { Driver, DriverCreatePayload } from '@/types/drivers'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-danger-600 font-medium">{message}</p>
}

// Tomorrow's date formatted as YYYY-MM-DD for min date picker constraint
const tomorrowIso = new Date(Date.now() + 86400000).toISOString().split('T')[0]

export function RegisterDriverModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: (driver: Driver) => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DriverRegisterFormValues>({
    resolver: zodResolver(driverRegisterSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      licenceNumber: '',
      licenceExpiry: '',
      address: '',
    },
  })

  const handleGeneratePassword = () => {
    const pwd = generateStrongPassword()
    setValue('password', pwd, { shouldValidate: true })
    setValue('confirmPassword', pwd, { shouldValidate: true })
    setHasPassword(true)
    setShowPassword(true)
  }

  const handleCopyPassword = () => {
    const pwd = getValues('password')
    if (!pwd) return
    navigator.clipboard.writeText(pwd)
    setCopiedPassword(true)
    setTimeout(() => setCopiedPassword(false), 2500)
  }

  const handleClose = () => {
    reset()
    setServerError(null)
    setCopiedPassword(false)
    setShowPassword(false)
    setHasPassword(false)
    onClose()
  }

  const onSubmit = async (values: DriverRegisterFormValues) => {
    setServerError(null)
    try {
      const payload: DriverCreatePayload = {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        confirmPassword: values.confirmPassword,
        licenceNumber: values.licenceNumber.trim().toUpperCase(),
        licenceExpiry: new Date(`${values.licenceExpiry}T23:59:59.999Z`).toISOString(),
        ...(values.phoneNumber?.trim() ? { phoneNumber: values.phoneNumber.trim() } : {}),
        ...(values.address?.trim() ? { address: values.address.trim() } : {}),
      }

      const res = await driversService.register(payload)

      reset()
      onSuccess(res.data.driver)
      handleClose()
    } catch (err) {
      setServerError(apiError(err).message)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Register Driver Account"
      description="Create a verified driver account, set initial credentials, and record commercial driving licence specifications."
      size="xl"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="register-driver-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Registering driver…' : 'Register driver'}
          </Button>
        </>
      }
    >
      <form
        id="register-driver-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
      >
        {serverError && <Notice tone="error">{serverError}</Notice>}

        {/* SECTION 1: Personal Details */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-3">
            1. Personal Information & Identity
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Full Name */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-ink-700">
                Full name <span className="text-brand-400">*</span>
                <div className="relative mt-1.5">
                  <UserRound className="absolute left-3 top-3 text-ink-500" size={17} />
                  <TextField
                    className="pl-10"
                    placeholder="e.g. Mwamba Phiri"
                    autoFocus
                    {...register('fullName')}
                  />
                </div>
                <FieldError message={errors.fullName?.message} />
              </label>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-ink-700">
                Email address <span className="text-brand-400">*</span>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-3 text-ink-500" size={17} />
                  <TextField
                    className="pl-10"
                    type="email"
                    placeholder="driver@transport.zm"
                    {...register('email')}
                  />
                </div>
                <FieldError message={errors.email?.message} />
              </label>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-ink-700">
                Phone number <span className="font-normal text-ink-500">(optional)</span>
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-3 text-ink-500" size={17} />
                  <TextField
                    className="pl-10"
                    type="tel"
                    placeholder="+260 97 1234567"
                    {...register('phoneNumber')}
                  />
                </div>
                <FieldError message={errors.phoneNumber?.message} />
              </label>
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-ink-700">
                Depot / Residential address <span className="font-normal text-ink-500">(optional)</span>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-3 text-ink-500" size={17} />
                  <TextField
                    className="pl-10"
                    placeholder="e.g. Plot 405, Great East Road, Lusaka"
                    {...register('address')}
                  />
                </div>
                <FieldError message={errors.address?.message} />
              </label>
            </div>
          </div>
        </div>

        {/* SECTION 2: Licence & Qualifications */}
        <div className="border-t border-ink-100 pt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-3">
            2. Commercial Driving Licence
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Licence Number */}
            <div>
              <label className="block text-sm font-semibold text-ink-700">
                Licence number <span className="text-brand-400">*</span>
                <div className="relative mt-1.5">
                  <CreditCard className="absolute left-3 top-3 text-ink-500" size={17} />
                  <TextField
                    className="pl-10 font-mono uppercase tracking-wider"
                    placeholder="e.g. DL-ZM-40912"
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
                  <TextField
                    className="pl-10"
                    type="date"
                    min={tomorrowIso}
                    {...register('licenceExpiry')}
                  />
                </div>
                <FieldError message={errors.licenceExpiry?.message} />
              </label>
            </div>
          </div>
        </div>

        {/* SECTION 3: Account Credentials */}
        <div className="border-t border-ink-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
              3. Initial Account Password
            </p>
            <button
              type="button"
              onClick={handleGeneratePassword}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-400 hover:text-brand-300"
            >
              <Sparkles size={14} />
              Generate strong password
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-ink-700">
                Password <span className="text-brand-400">*</span>
                <div className="relative mt-1.5">
                  <LockKeyhole className="absolute left-3 top-3 text-ink-500" size={17} />
                  <TextField
                    className="pl-10 pr-16"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 12 characters"
                    autoComplete="new-password"
                    {...register('password', {
                      onChange: (e) => setHasPassword(Boolean(e.target.value)),
                    })}
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    {hasPassword && (
                      <button
                        type="button"
                        onClick={handleCopyPassword}
                        className="rounded p-1 text-ink-500 hover:text-ink-900"
                        title="Copy password"
                      >
                        {copiedPassword ? <Check size={16} className="text-success-500" /> : <Copy size={16} />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="rounded p-1 text-ink-500 hover:text-ink-900"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <FieldError message={errors.password?.message} />
              </label>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-ink-700">
                Confirm password <span className="text-brand-400">*</span>
                <div className="relative mt-1.5">
                  <LockKeyhole className="absolute left-3 top-3 text-ink-500" size={17} />
                  <TextField
                    className="pl-10"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    {...register('confirmPassword')}
                  />
                </div>
                <FieldError message={errors.confirmPassword?.message} />
              </label>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-ink-500 leading-normal">
            Must be at least 12 characters with an uppercase letter, lowercase letter, number, and symbol. Newly created driver accounts are activated immediately upon administrator registration.
          </p>
        </div>
      </form>
    </Modal>
  )
}
