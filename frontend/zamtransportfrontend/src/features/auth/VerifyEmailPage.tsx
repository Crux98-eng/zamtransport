import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BusFront, CheckCircle2, CircleAlert, Mail, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { apiError } from '@/services/api'
import { authService } from '@/services/auth'
import { setPendingAccount } from '@/stores/auth-store'

type VerificationState =
  | { kind: 'loading' }
  | { kind: 'success'; role: 'COMMUTER' | 'DRIVER'; email: string; fullName: string }
  | { kind: 'error'; message: string }

export function VerifyEmailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const token = new URLSearchParams(location.search).get('token')
  const verificationRequest = useRef<ReturnType<typeof authService.verifyEmail> | null>(null)
  const [state, setState] = useState<VerificationState>({ kind: 'loading' })
  const [email, setEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resendFeedback, setResendFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    let active = true
    if (!token) {
      setState({ kind: 'error', message: 'This verification link is missing its token. Request a new link below.' })
      return () => { active = false }
    }

    verificationRequest.current ||= authService.verifyEmail(token)
    window.history.replaceState(window.history.state, '', '/verify-email')
    verificationRequest.current
      .then(({ data }) => {
        if (!active) return
        setPendingAccount({
          fullName: data.fullName,
          email: data.email,
          role: data.role,
          status: data.status,
          emailVerified: true,
          verificationEmailAccepted: true,
        })
        setEmail(data.email)
        setState({ kind: 'success', role: data.role, email: data.email, fullName: data.fullName })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({ kind: 'error', message: apiError(error).message })
      })
    return () => { active = false }
  }, [token])

  async function resend(event: FormEvent) {
    event.preventDefault()
    setResending(true)
    setResendFeedback(null)
    try {
      const response = await authService.resendVerification(email.trim())
      setResendFeedback({ tone: 'success', message: response.message })
    } catch (error) {
      setResendFeedback({ tone: 'error', message: apiError(error).message })
    } finally {
      setResending(false)
    }
  }

  const success = state.kind === 'success'
  const driverVerified = success && state.role === 'DRIVER'

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_70%_0%,rgba(255,90,43,.3),transparent_50%),#101012] p-4">
      <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink-50 p-7 shadow-2xl sm:p-9">
        <Link to="/" className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-500 text-white shadow-[0_8px_22px_rgba(255,90,43,.25)]" aria-label="Zambia Transport home">
          <BusFront size={26} />
        </Link>
        <p className="mt-6 text-center text-xs font-bold uppercase tracking-[.16em] text-brand-500">Zambia Transport System</p>

        {state.kind === 'loading' && (
          <div className="py-10 text-center" role="status" aria-live="polite">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-500"><Mail size={28} /></span>
            <h1 className="mt-5 text-2xl font-extrabold text-ink-900">Verifying your email</h1>
            <p className="mt-2 text-sm text-ink-500">Please wait while we securely confirm your address.</p>
          </div>
        )}

        {state.kind === 'success' && (
          <div className="py-7 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-50 text-success-600">
              {driverVerified ? <ShieldCheck size={30} /> : <CheckCircle2 size={30} />}
            </span>
            <h1 className="mt-5 text-2xl font-extrabold text-ink-900">{driverVerified ? 'Email verified' : 'Your account is active'}</h1>
            <p className="mt-3 text-sm leading-6 text-ink-500">
              {driverVerified
                ? 'Your driver application is now waiting for administrator approval. Email verification does not approve driver applications.'
                : 'Your commuter email is verified and your account is ready. You can now sign in.'}
            </p>
            <p className="mt-4 rounded-lg bg-ink-950 px-3 py-2 text-sm font-semibold text-ink-700">{state.email}</p>
            <Button className="mt-6 w-full" onClick={() => navigate(driverVerified ? '/pending-approval' : '/login', { replace: true })}>
              {driverVerified ? 'View approval status' : 'Continue to sign in'}
            </Button>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="py-7">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-danger-50 text-danger-500"><CircleAlert size={30} /></span>
            <h1 className="mt-5 text-center text-2xl font-extrabold text-ink-900">We couldn’t verify this link</h1>
            <Notice className="mt-4" message={state.message} />
            <p className="mt-4 text-center text-sm leading-6 text-ink-500">Verification links expire after 30 minutes and can only be used once. Request a fresh link if this one has expired.</p>
            <form className="mt-6 space-y-3" onSubmit={resend}>
              <label className="block text-sm font-semibold text-ink-700">
                Email address
                <TextField className="mt-1.5" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </label>
              <Button className="w-full" type="submit" variant="secondary" disabled={resending || !email.trim()}>{resending ? 'Sending…' : 'Resend verification link'}</Button>
              {resendFeedback && <Notice tone={resendFeedback.tone} message={resendFeedback.message} />}
            </form>
          </div>
        )}
        <p className="mt-2 text-center text-sm text-ink-500">Need help? <Link className="font-bold text-brand-400 hover:text-brand-500" to="/login">Return to sign in</Link></p>
      </section>
    </main>
  )
}
