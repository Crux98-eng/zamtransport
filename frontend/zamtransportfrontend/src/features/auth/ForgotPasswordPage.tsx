import { zodResolver } from '@hookform/resolvers/zod'
import { BusFront, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { apiError } from '@/services/api'
import { authService } from '@/services/auth'

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(191),
})

type ForgotPasswordFields = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<ForgotPasswordFields>({
    resolver: zodResolver(schema),
  })

  async function submit(values: ForgotPasswordFields) {
    try {
      await authService.requestPasswordReset(values.email)
      setSubmitted(true)
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
        <h1 className="mt-2 text-2xl font-extrabold text-ink-900">Forgot your password?</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">Enter your account email and we’ll send a secure password reset link if it matches an account.</p>

        {submitted && (
          <Notice tone="success" className="mt-5">
            If an account exists for that email, a reset link will arrive shortly. Check your inbox and spam folder.
          </Notice>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit(submit)} noValidate>
          <label className="block text-sm font-semibold text-ink-700">
            Email
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-3 text-ink-500" size={17} />
              <TextField className="pl-10" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
            </div>
            {errors.email && <p className="mt-1.5 text-xs text-danger-600">{errors.email.message}</p>}
          </label>
          {errors.root && <Notice>{errors.root.message}</Notice>}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          Remembered your password? <Link className="font-bold text-brand-400 hover:text-brand-500" to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  )
}
