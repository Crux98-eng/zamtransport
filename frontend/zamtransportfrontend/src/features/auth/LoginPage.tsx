import { zodResolver } from '@hookform/resolvers/zod'
import { BusFront, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/forms/TextField'
import { Notice } from '@/components/ui/Notice'
import { apiError } from '@/services/api'
import { useAuth } from '@/features/auth/AuthProvider'

const schema = z.object({ email: z.string().trim().email('Enter a valid email address.'), password: z.string().min(1, 'Enter your password.') })
type LoginFields = z.infer<typeof schema>
type LoginLocationState = { from?: string; message?: string }
export function LoginPage() {
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const [showPassword, setShowPassword] = useState(false)
  const redirectState = location.state as LoginLocationState | null
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<LoginFields>({ resolver: zodResolver(schema) })
  async function submit(values: LoginFields) { try { await login(values); navigate(redirectState?.from?.startsWith('/') ? redirectState.from : '/dashboard', { replace: true }) } catch (error) { setError('root', { message: apiError(error).message }) } }
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_70%_0%,rgba(255,90,43,.3),transparent_50%),#101012] p-4"><section className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-50 p-7 shadow-2xl sm:p-9"><Link to="/" className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500 text-white shadow-[0_8px_22px_rgba(255,90,43,.25)]"><BusFront size={26} /></Link><h1 className="mt-6 text-2xl font-extrabold text-ink-900">Welcome back</h1><p className="mt-2 text-sm text-ink-500">Sign in to access Zambia Transport operations.</p><form className="mt-7 space-y-5" onSubmit={handleSubmit(submit)} noValidate><label className="block text-sm font-semibold text-ink-700">Email<div className="relative mt-1.5"><Mail className="absolute left-3 top-3 text-ink-500" size={17} /><TextField className="pl-10" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} /></div>{errors.email && <p className="mt-1.5 text-xs text-danger-600">{errors.email.message}</p>}</label><label className="block text-sm font-semibold text-ink-700">Password<div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-3 text-ink-500" size={17} /><TextField className="pl-10 pr-10" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" {...register('password')} /><button className="absolute right-2 top-2 rounded p-1 text-ink-500 hover:text-ink-900" type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors.password && <p className="mt-1.5 text-xs text-danger-600">{errors.password.message}</p>}</label>{redirectState?.message && !errors.root && <Notice>{redirectState.message}</Notice>}{errors.root && <Notice>{errors.root.message}</Notice>}<Button className="w-full" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Button></form><p className="mt-6 text-center text-sm text-ink-500">Need an account? <Link className="font-bold text-brand-400 hover:text-brand-500" to="/register">Request access</Link></p></section></main>
}
