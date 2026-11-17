import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() }
export function UserMenu() {
  const [open, setOpen] = useState(false); const { user, logout } = useAuth()
  async function signOut() { setOpen(false); await logout() }
  if (!user) return null
  return <div className="relative"><button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-white/10" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-400">{initials(user.fullName)}</span><span className="hidden max-w-32 truncate lg:block">{user.fullName}</span><ChevronDown size={15} /></button>{open && <section onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }} className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-white/10 bg-ink-50 p-2 text-ink-900 shadow-2xl" role="menu"><div className="border-b border-ink-100 px-3 pb-3 pt-1"><p className="truncate text-sm font-bold">{user.fullName}</p><p className="mt-1 truncate text-xs text-ink-500">{user.email}</p><p className="mt-2 text-xs font-bold text-brand-400">{user.role}</p></div><Link onClick={() => setOpen(false)} to="/profile" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-brand-50" role="menuitem"><UserRound size={16} />My profile</Link><button className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-danger-600 hover:bg-danger-50" onClick={() => void signOut()} role="menuitem"><LogOut size={16} />Sign out</button></section>}</div>
}
