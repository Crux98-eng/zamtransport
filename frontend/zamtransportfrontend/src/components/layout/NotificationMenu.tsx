import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { notificationService } from '@/services/notifications'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'

const notificationKeys = { count: ['notifications', 'unread-count'] as const, list: ['notifications', 'recent'] as const }
export function NotificationMenu() {
  //declaration for contant variable to hold data
  const [open, setOpen] = useState(false); const { phase } = useAuth(); const client = useQueryClient(); const enabled = phase === 'authenticated'
  const count = useQuery({ queryKey: notificationKeys.count, queryFn: notificationService.unreadCount, enabled, refetchInterval: 60_000 })
  const recent = useQuery({ queryKey: notificationKeys.list, queryFn: () => notificationService.list({ limit: 5 }), enabled: enabled && open })
  const markAll = useMutation({ mutationFn: notificationService.markAllRead, onSuccess: () => void client.invalidateQueries({ queryKey: ['notifications'] }) })
  const unread = count.data?.data.count ?? 0

  return (
    <div className="relative">
      <button aria-label="Notifications" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)} className="relative grid h-10 w-10 place-items-center rounded-lg text-ink-700 transition hover:bg-white/10 hover:text-white"><Bell size={20} />
        {unread > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}
        </span>
        }
      </button>
      {open && <section className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-ink-50 text-ink-900 shadow-2xl" role="menu">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <div>
            <p className="font-bold">Notifications</p>
            <p className="text-xs text-ink-500">{unread ? `${unread} unread` : 'You are up to date'}</p>
          </div>
          <button onClick={() => markAll.mutate()} disabled={!unread || markAll.isPending} className="rounded p-1.5 text-brand-400 hover:bg-brand-50 disabled:opacity-40" aria-label="Mark all notifications as read"><CheckCheck size={18} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">{recent.isLoading && <div className="grid min-h-24 place-items-center text-ink-500"><LoaderCircle className="animate-spin" size={20} />
        </div>}
          {recent.isError && <p className="p-4 text-sm text-danger-600">Notifications could not be loaded.</p>}
          {recent.data?.data.notifications.length === 0 && <p className="p-4 text-sm text-ink-500">No notifications yet.</p>}
          {recent.data?.data.notifications.map((notification) => <Link onClick={() => setOpen(false)} to="/notifications" className={cn('block border-b border-ink-100 px-4 py-3 hover:bg-brand-50', !notification.isRead && 'bg-brand-50/50')} key={notification.id}>
            <p className="text-sm font-bold">{notification.title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-500">{notification.message}</p>
          </Link>)}
        </div>
        <Link onClick={() => setOpen(false)} to="/notifications" className="block px-4 py-3 text-center text-sm font-bold text-brand-400 hover:bg-brand-50">View notification centre</Link>
      </section>
      }
    </div>)
}
