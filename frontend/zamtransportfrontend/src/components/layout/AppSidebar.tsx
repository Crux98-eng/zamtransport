import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { navigationFor } from '@/app/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
const logo = new URL('@/assets/logo.png', import.meta.url).href

export function AppSidebar({ collapsed, mobile = false, onClose, onToggle }: { collapsed: boolean; mobile?: boolean; onClose?: () => void; onToggle?: () => void }) {

  const { user } = useAuth();
  const groups = navigationFor(user);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Workspace: true })

  return (
  <aside className={cn('flex h-full flex-col border-r border-white/10 bg-[#151518] text-white transition-[width] duration-200', mobile ? 'w-72' : collapsed ? 'w-20' : 'w-72')} aria-label="Primary navigation">
    <div className="flex h-20 items-center border-b border-white/10 px-4">
      <NavLink to="/dashboard" onClick={onClose} className="flex min-w-0 items-center gap-3 text-lg font-extrabold tracking-tight">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500 shadow-[0_8px_22px_rgba(255,90,43,.25)]">
         
          <img src={logo} alt="ZamTransport Logo" className="h-6 w-6" />
        </span>
        {(!collapsed || mobile) && <span className="truncate">ZamTransport</span>}
      </NavLink>
      <button onClick={mobile ? onClose : onToggle} className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-white/10 hover:text-white" aria-label={mobile ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {mobile ? <X size={19} /> : collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
      </button>
    </div>
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      {groups.map((group) => {
        const isExpanded = expanded[group.label] ?? true; return <section className="mb-5" key={group.label}>
          <button className={cn('flex w-full items-center gap-2 px-2 pb-2 text-left text-[11px] font-bold uppercase tracking-[.13em] text-ink-500', collapsed && !mobile && 'justify-center')} onClick={() => setExpanded((value) => ({ ...value, [group.label]: !isExpanded }))} aria-expanded={isExpanded}>{(!collapsed || mobile) && <span>{group.label}</span>}
            {(!collapsed || mobile) && (isExpanded ? <ChevronDown className="ml-auto" size={14} /> : <ChevronRight className="ml-auto" size={14} />)}
          </button>
          {isExpanded && <div className="space-y-1">{group.items.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} onClick={onClose} title={collapsed && !mobile ? label : undefined} className={({ isActive }) => cn('group flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-ink-500 transition hover:bg-white/[.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400', isActive && 'bg-brand-500 text-white shadow-[0_8px_20px_rgba(255,90,43,.2)]', collapsed && !mobile && 'justify-center px-0')}>
            <Icon size={18} />
            <span className={cn('truncate', collapsed && !mobile && 'sr-only')}>{label}</span></NavLink>)}
          </div>}
        </section>
      })}
    </nav>
    <div className={cn('border-t border-white/10 p-4 text-xs text-ink-500', collapsed && !mobile && 'text-center')}>{(!collapsed || mobile) ? 'Zambia Transport System' : 'ZT'}
    </div>
  </aside>
  )
}
