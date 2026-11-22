import { useState, type FormEvent } from 'react'
import { BusFront, Clock3, MailCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { TextField } from '@/components/forms/TextField'
import { apiError } from '@/services/api'
import { authService } from '@/services/auth'
import { getPendingAccount } from '@/stores/auth-store'
import { useAuth } from './AuthProvider'

export function PendingApprovalPage() {
  const account = getPendingAccount()
  const navigate = useNavigate()
  const { clearPendingRegistration } = useAuth()
  const [email, setEmail] = useState(account?.email ?? '')
  const [resending, setResending] = useState(false)
  const [resendFeedback, setResendFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const isDriver = account?.role === 'DRIVER'
  const verified = account?.emailVerified === true

  const returnToLogin = () => {
    clearPendingRegistration()
    navigate('/login', { replace: true })
  }

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

  const heading = isDriver && verified ? 'Approval pending' : 'Verify your email'
  const description = isDriver
    ? verified
      ? 'Your email is verified. Your driver application is waiting for administrator review; verification does not approve the application.'
      : 'Verify your email address first. Your driver application will then be available for administrator review.'
    : 'We sent a secure verification link to your email. Verify your address to activate your commuter account.'

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_70%_0%,rgba(255,90,43,.3),transparent_50%),#101012] p-4">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-50 p-7 shadow-2xl sm:p-9">
        <Link to="/" className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-500 text-white shadow-[0_8px_22px_rgba(255,90,43,.25)]" aria-label="Zambia Transport home">
          <BusFront size={26} />
        </Link>
        <p className="mt-6 text-center text-xs font-bold uppercase tracking-[.16em] text-brand-500">Zambia Transport System</p>
        <span className="mx-auto mt-5 grid h-16 w-16 place-items-center rounded-full bg-warning-50 text-warning-400"><Clock3 size={30} /></span>
        <h1 className="mt-5 text-center text-2xl font-extrabold text-ink-900">{heading}</h1>
        <p className="mt-3 text-center text-sm leading-6 text-ink-500">{description}</p>

        {account && <div className="mt-6 rounded-xl border border-ink-100 bg-ink-950 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{isDriver ? 'Driver application' : 'Commuter account'}</p>
          <p className="mt-2 text-center font-bold text-ink-900">{account.fullName}</p>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-ink-500"><MailCheck size={16} className="text-brand-400" />{account.email}</p>
        </div>}

        {account?.verificationEmailAccepted === false && !verified && <Notice className="mt-5 text-left">The email provider did not accept the verification message. You can request another below.</Notice>}
        {!verified && <form className="mt-6 space-y-3" onSubmit={resend}>
          <label className="block text-left text-sm font-semibold text-ink-700">
            Resend verification email
            <TextField className="mt-1.5" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <Button className="w-full" type="submit" variant="secondary" disabled={resending || !email.trim()}>{resending ? 'Sending…' : 'Resend verification link'}</Button>
          {resendFeedback && <Notice className="text-left" tone={resendFeedback.tone} message={resendFeedback.message} />}
          <p className="text-xs leading-5 text-ink-500">For privacy, we show the same confirmation whether or not an eligible account exists.</p>
        </form>}

        <Button className="mt-6 w-full" onClick={returnToLogin}>Return to sign in</Button>
      </section>
    </main>
  )
}
