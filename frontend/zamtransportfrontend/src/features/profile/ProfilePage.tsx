import { Mail, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'

export function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null
  return <div className="space-y-6"><PageHeader title="My profile" description="Your authenticated account information." /><Card className="max-w-2xl overflow-hidden"><div className="flex items-center gap-4 border-b border-ink-100 p-6"><span className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-400"><UserRound size={26} /></span><div><h2 className="text-lg font-bold text-ink-900">{user.fullName}</h2><p className="mt-1 text-sm text-ink-500">{user.role} · {user.status}</p></div></div><dl className="grid sm:grid-cols-2"><div className="border-b border-ink-100 p-5 sm:border-r"><dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-500"><Mail size={14} />Email</dt><dd className="mt-2 text-sm font-semibold text-ink-900">{user.email}</dd></div><div className="border-b border-ink-100 p-5"><dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-500"><Phone size={14} />Phone</dt><dd className="mt-2 text-sm font-semibold text-ink-900">{user.phoneNumber || 'Not provided'}</dd></div><div className="p-5 sm:border-r"><dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-500"><ShieldCheck size={14} />Account role</dt><dd className="mt-2 text-sm font-semibold text-ink-900">{user.role}</dd></div><div className="p-5"><dt className="text-xs font-bold uppercase tracking-wide text-ink-500">Account status</dt><dd className="mt-2 text-sm font-semibold text-success-500">{user.status}</dd></div></dl></Card></div>
}
