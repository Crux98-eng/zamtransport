import { Menu } from 'lucide-react'
import { Breadcrumbs } from '@/components/shared/Breadcrumbs'
import { NotificationMenu } from '@/components/layout/NotificationMenu'
import { UserMenu } from '@/components/layout/UserMenu'

export function AppTopbar({ onMenu }: { onMenu: () => void }) {
  return <header className="sticky top-0 z-20 flex h-20 items-center gap-3 border-b border-white/10 bg-ink-950/90 px-4 text-white shadow-lg backdrop-blur sm:px-6"><button onClick={onMenu} className="grid h-10 w-10 place-items-center rounded-lg text-ink-700 transition hover:bg-white/10 hover:text-white" aria-label="Open navigation"><Menu size={21} /></button><div className="min-w-0"><p className="hidden text-sm font-bold sm:block">Operations workspace</p><div className="hidden sm:block"><Breadcrumbs /></div></div><div className="ml-auto flex items-center gap-1"><NotificationMenu /><UserMenu /></div></header>
}
