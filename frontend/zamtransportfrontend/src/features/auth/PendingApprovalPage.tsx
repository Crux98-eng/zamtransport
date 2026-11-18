import { BusFront, Clock3, MailCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { getPendingAccount } from '@/stores/auth-store'
import { useAuth } from './AuthProvider'

export function PendingApprovalPage() {
  const account = getPendingAccount()
  const navigate = useNavigate()
  const { clearPendingRegistration } = useAuth()
  const returnToLogin = () => {
    clearPendingRegistration()
    navigate('/login', { replace: true })
  }

  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_70%_0%,rgba(255,90,43,.3),transparent_50%),#101012] p-4">
    <section className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-50 p-7 text-center shadow-2xl sm:p-9">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-500 text-white">
        <BusFront size={26} />
      </span>
      <span className="mx-auto mt-6 grid h-16 w-16 place-items-center rounded-full bg-warning-50 text-warning-400">
        <Clock3 size={30} /></span><h1 className="mt-5 text-2xl font-extrabold text-ink-900">Approval pending</h1><p className="mt-3 text-sm leading-6 text-ink-500">Your registration was submitted successfully. An administrator must approve your account before you can sign in.</p><Notice className="mt-5 text-left" tone="success">Registration request received.</Notice>
      {account && <div className="mt-6 rounded-xl border border-ink-100 bg-ink-950 p-4 text-left">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Registration request</p>
        <p className="mt-2 font-bold text-ink-900">{account.fullName}</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-500">
          <MailCheck size={16} className="text-brand-400" />
          {account.email}</p>
      </div>}
      <Button className="mt-7 w-full" onClick={returnToLogin}>Return to sign in</Button>
    </section>
  </main>
}
