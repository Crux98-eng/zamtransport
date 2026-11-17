import { zodResolver } from '@hookform/resolvers/zod'
import { BusFront, LockKeyhole, Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/forms/TextField'
import { api, apiMessage } from '@/services/api'
import { setSession } from '@/stores/auth-store'
import type { ApiEnvelope, AuthTokens, User } from '@/types/api'

const schema = z.object({ email: z.string().email('Enter a valid email address.'), password: z.string().min(1, 'Enter your password.') })
type LoginFields = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<LoginFields>({ resolver: zodResolver(schema) })
  async function submit(values: LoginFields) {
    try { const result = await api.post<ApiEnvelope<{ user: User } & AuthTokens>>('/auth/login', values); setSession(result.data.data); navigate('/dashboard') }
    catch (error) { setError('root', { message: apiMessage(error) }) }
  }
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_70%_0%,rgba(255,90,43,.3),transparent_50%),#101012] p-4"><section className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-50 p-7 shadow-2xl sm:p-9"><Link to="/" className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500 text-white shadow-[0_8px_22px_rgba(255,90,43,.25)]"><BusFront size={26} /></Link><h1 className="mt-6 text-2xl font-extrabold text-ink-900">Welcome back</h1><p className="mt-2 text-sm text-ink-500">Sign in to manage Zambia Transport operations.</p><form className="mt-7 space-y-5" onSubmit={handleSubmit(submit)}><label className="block text-sm font-semibold text-ink-700">Email<div className="relative mt-1.5"><Mail className="absolute left-3 top-3 text-ink-500" size={17} /><TextField className="pl-10" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} /></div>{errors.email && <p className="mt-1.5 text-xs text-danger-600">{errors.email.message}</p>}</label><label className="block text-sm font-semibold text-ink-700">Password<div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-3 text-ink-500" size={17} /><TextField className="pl-10" type="password" autoComplete="current-password" placeholder="••••••••" {...register('password')} /></div>{errors.password && <p className="mt-1.5 text-xs text-danger-600">{errors.password.message}</p>}</label>{errors.root && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{errors.root.message}</p>}<Button className="w-full" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Button></form><p className="mt-6 text-center text-xs text-ink-500">New to ZamTransport? Contact your system administrator.</p></section></main>
}
