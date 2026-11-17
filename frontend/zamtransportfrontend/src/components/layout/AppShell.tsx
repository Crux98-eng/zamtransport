import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppTopbar } from '@/components/layout/AppTopbar'
import { cn } from '@/lib/utils'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const drawerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  useEffect(() => { if (mobileOpen) drawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus() }, [mobileOpen])
  return <div className="min-h-screen bg-ink-950"><div className="fixed inset-y-0 left-0 z-30 hidden md:block"><AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} /></div>{mobileOpen && <div className="fixed inset-0 z-40 md:hidden"><button className="absolute inset-0 h-full w-full bg-black/60" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /><div className="relative h-full w-72 shadow-2xl" ref={drawerRef}><AppSidebar collapsed={false} mobile onClose={() => setMobileOpen(false)} /></div></div>}<div className={cn('min-h-screen transition-[margin] duration-200', collapsed ? 'md:ml-20' : 'md:ml-72')}><AppTopbar onMenu={() => setMobileOpen(true)} /><main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8"><Outlet /></main></div></div>
}
