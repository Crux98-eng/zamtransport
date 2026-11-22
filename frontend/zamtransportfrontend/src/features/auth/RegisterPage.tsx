import { zodResolver } from '@hookform/resolvers/zod'
import { BusFront, CalendarDays, Eye, EyeOff, IdCard, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { TextField } from '@/components/forms/TextField'
import { Notice } from '@/components/ui/Notice'
import { Button } from '@/components/ui/Button'
import { apiError } from '@/services/api'
import { useAuth } from '@/features/auth/AuthProvider'

const schema = z.object({
  accountType: z.enum(['COMMUTER', 'DRIVER']),
  fullName: z.string().trim().min(2, 'Enter your full name.').max(150),
  email: z.string().trim().email('Enter a valid email address.').max(191),
  phoneNumber: z.string().trim().max(30).refine((value) => value === '' || value.length >= 5, 'Use at least 5 characters.'),
  password: z.string().min(12, 'Use at least 12 characters.').max(128).regex(/[a-z]/, 'Include a lowercase letter.').regex(/[A-Z]/, 'Include an uppercase letter.').regex(/[0-9]/, 'Include a number.').regex(/[^A-Za-z0-9]/, 'Include a symbol.'),
  confirmPassword: z.string(),
  licenceNumber: z.string(),
  licenceExpiry: z.string(),
  address: z.string().max(255, 'Address cannot exceed 255 characters.'),
}).superRefine((values, context) => {
  if (values.password !== values.confirmPassword) context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' })
  if (values.accountType === 'DRIVER') {
    if (values.licenceNumber.trim().length < 2 || values.licenceNumber.trim().length > 100) context.addIssue({ code: 'custom', path: ['licenceNumber'], message: 'Enter a valid licence number.' })
    const expiry = new Date(`${values.licenceExpiry}T00:00:00`)
    if (!values.licenceExpiry || !Number.isFinite(expiry.getTime()) || expiry <= new Date()) context.addIssue({ code: 'custom', path: ['licenceExpiry'], message: 'Licence expiry must be in the future.' })
  }
})

type RegisterFields = z.infer<typeof schema>
const inputClass = 'pl-10'
function FieldError({ message }: { message?: string }) { return message ? <p className="mt-1.5 text-xs text-danger-600">{message}</p> : null }

export function RegisterPage() {
  const { register: createAccount, registerDriver } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting }, setError } = useForm<RegisterFields>({
    resolver: zodResolver(schema),
    defaultValues: { accountType: 'COMMUTER', phoneNumber: '', licenceNumber: '', licenceExpiry: '', address: '' },
  })
  const accountType = watch('accountType')
  const isDriver = accountType === 'DRIVER'

  async function submit(values: RegisterFields) {
    try {
      if (isDriver) {
        await registerDriver({
          fullName: values.fullName,
          email: values.email,
          phoneNumber: values.phoneNumber || undefined,
          password: values.password,
          confirmPassword: values.confirmPassword,
          licenceNumber: values.licenceNumber.trim(),
          licenceExpiry: values.licenceExpiry,
          address: values.address.trim() || undefined,
        })
      } else {
        await createAccount({
          fullName: values.fullName,
          email: values.email,
          phoneNumber: values.phoneNumber || undefined,
          password: values.password,
          confirmPassword: values.confirmPassword,
        })
      }
      navigate('/pending-approval', { replace: true })
    } catch (error) {
      setError('root', { message: apiError(error).message })
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_70%_0%,rgba(255,90,43,.3),transparent_50%),#101012] p-4">
      <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-ink-50 p-7 shadow-2xl sm:p-9">
        <Link to="/" className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500 text-white shadow-[0_8px_22px_rgba(255,90,43,.25)]" aria-label="Zambia Transport home">
          <BusFront size={26} />
        </Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-brand-500">Zambia Transport System</p>
        <h1 className="mt-2 text-2xl font-extrabold text-ink-900">Create your account</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">Verify your email to activate your account. Driver applications also require administrator approval.</p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-ink-950 p-1.5">
          {(['COMMUTER', 'DRIVER'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setValue('accountType', type, { shouldValidate: true })}
              aria-pressed={accountType === type}
              className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${accountType === type ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}
            >
              {type === 'COMMUTER' ? 'Commuter' : 'Driver application'}
            </button>
          ))}
        </div>

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(submit)} noValidate>
          <label className="block text-sm font-semibold text-ink-700 sm:col-span-2">
            Full name
            <div className="relative mt-1.5"><UserRound className="absolute left-3 top-3 text-ink-500" size={17} /><TextField className={inputClass} autoComplete="name" {...register('fullName')} /></div>
            <FieldError message={errors.fullName?.message} />
          </label>
          <label className="block text-sm font-semibold text-ink-700 sm:col-span-2">
            Email
            <div className="relative mt-1.5"><Mail className="absolute left-3 top-3 text-ink-500" size={17} /><TextField className={inputClass} type="email" autoComplete="email" {...register('email')} /></div>
            <FieldError message={errors.email?.message} />
          </label>
          <label className="block text-sm font-semibold text-ink-700 sm:col-span-2">
            Phone number <span className="font-normal text-ink-500">(optional)</span>
            <div className="relative mt-1.5"><Phone className="absolute left-3 top-3 text-ink-500" size={17} /><TextField className={inputClass} type="tel" autoComplete="tel" {...register('phoneNumber')} /></div>
            <FieldError message={errors.phoneNumber?.message} />
          </label>

          {isDriver && (
            <>
              <label className="block text-sm font-semibold text-ink-700">
                Driver licence number
                <div className="relative mt-1.5"><IdCard className="absolute left-3 top-3 text-ink-500" size={17} /><TextField className={inputClass} autoComplete="off" {...register('licenceNumber')} /></div>
                <FieldError message={errors.licenceNumber?.message} />
              </label>
              <label className="block text-sm font-semibold text-ink-700">
                Licence expiry
                <div className="relative mt-1.5"><CalendarDays className="absolute left-3 top-3 text-ink-500" size={17} /><TextField className={inputClass} type="date" {...register('licenceExpiry')} /></div>
                <FieldError message={errors.licenceExpiry?.message} />
              </label>
              <label className="block text-sm font-semibold text-ink-700 sm:col-span-2">
                Address <span className="font-normal text-ink-500">(optional)</span>
                <textarea {...register('address')} rows={2} className="mt-1.5 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-400" />
                <FieldError message={errors.address?.message} />
              </label>
            </>
          )}

          <label className="block text-sm font-semibold text-ink-700">
            Password
            <div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-3 text-ink-500" size={17} /><TextField className="pl-10 pr-10" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('password')} /><button className="absolute right-2 top-2 rounded p-1 text-ink-500 hover:text-ink-900" type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <FieldError message={errors.password?.message} />
          </label>
          <label className="block text-sm font-semibold text-ink-700">
            Confirm password
            <div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-3 text-ink-500" size={17} /><TextField className={inputClass} type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('confirmPassword')} /></div>
            <FieldError message={errors.confirmPassword?.message} />
          </label>

          {errors.root && <Notice className="sm:col-span-2">{errors.root.message}</Notice>}
          <Button className="mt-1 w-full sm:col-span-2" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : isDriver ? 'Submit driver application' : 'Create commuter account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">Already have access? <Link className="font-bold text-brand-400 hover:text-brand-500" to="/login">Sign in</Link></p>
      </section>
    </main>
  )
}
