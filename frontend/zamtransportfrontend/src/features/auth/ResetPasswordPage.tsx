import { zodResolver } from '@hookform/resolvers/zod'
import { BusFront, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { apiError } from '@/services/api'
import { authService } from '@/services/auth'

const schema = z.object({
  password: z.string()
    .min(12, 'Use at least 12 characters.')
    .max(128)
    .regex(/[a-z]/, 'Include a lowercase letter.')
    .regex(/[A-Z]/, 'Include an uppercase letter.')
    .regex(/[0-9]/, 'Include a number.')
    .regex(/[^A-Za-z0-9]/, 'Include a symbol.'),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match.',
})

type ResetPasswordFields = z.infer<typeof schema>

export function ResetPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const token = new URLSearchParams(location.search).get('token')
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<ResetPasswordFields>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', '/reset-password')
  }, [token])

  async function submit(values: ResetPasswordFields) {
    if (!token) return
    try {
      await authService.resetPassword({ token, ...values })
      navigate('/login', {
        replace: true,
        state: { message: 'Your password has been reset. Sign in with your new password.' },
      })
    } catch (error) {
      setError('root', { message: apiError(error).message })
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_70%_0%,rgba(255,90,43,.3),transparent_50%),#101012] p-4">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-50 p-7 shadow-2xl sm:p-9">
        <Link to="/" className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500 text-white shadow-[0_8px_22px_rgba(255,90,43,.25)]" aria-label="Zambia Transport home">
          <BusFront size={26} />
        </Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-brand-500">Zambia Transport System</p>
        <h1 className="mt-2 text-2xl font-extrabold text-ink-900">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>

        {!token ? (
          <div className="mt-6 space-y-4">
            <Notice tone="error">This reset link is missing or no longer available. Request a new one to continue.</Notice>
            <Link className="block text-center text-sm font-bold text-brand-400 hover:text-brand-500" to="/forgot-password">Request another reset link</Link>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit(submit)} noValidate>
            <label className="block text-sm font-semibold text-ink-700">
              New password
              <div className="relative mt-1.5">
                <LockKeyhole className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField className="pl-10 pr-10" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('password')} />
                <button className="absolute right-2 top-2 rounded p-1 text-ink-500 hover:text-ink-900" type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-danger-600">{errors.password.message}</p>}
            </label>
            <label className="block text-sm font-semibold text-ink-700">
              Confirm new password
              <div className="relative mt-1.5">
                <LockKeyhole className="absolute left-3 top-3 text-ink-500" size={17} />
                <TextField className="pl-10" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('confirmPassword')} />
              </div>
              {errors.confirmPassword && <p className="mt-1.5 text-xs text-danger-600">{errors.confirmPassword.message}</p>}
            </label>
            {errors.root && <Notice tone="error">{errors.root.message}</Notice>}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Resetting password…' : 'Reset password'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink-500">
          <Link className="font-bold text-brand-400 hover:text-brand-500" to="/login">Return to sign in</Link>
        </p>
      </section>
    </main>
  )
}
