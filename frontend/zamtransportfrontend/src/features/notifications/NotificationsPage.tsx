import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, CheckCheck, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState } from '@/components/shared/PageState'
import { PageHeader } from '@/components/shared/PageHeader'
import { notificationService, type Notification } from '@/services/notifications'
import { cn } from '@/lib/utils'

const keys = { list: ['notifications', 'page'] as const }
function dateLabel(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function NotificationRow({ notification, onRead, pending }: { notification: Notification; onRead: (id: number) => void; pending: boolean }) {
  return <article className={cn('flex gap-4 border-b border-ink-100 p-5 last:border-0', !notification.isRead && 'bg-brand-50/50')}><span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', notification.isRead ? 'bg-ink-100' : 'bg-brand-500')} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-ink-900">{notification.title}</h2><span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-500">{notification.type.replaceAll('_', ' ')}</span></div><p className="mt-1 text-sm leading-6 text-ink-500">{notification.message}</p><p className="mt-2 text-xs text-ink-500">{dateLabel(notification.createdAt)}</p></div>{!notification.isRead && <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-brand-400 hover:bg-brand-50 disabled:opacity-40" onClick={() => onRead(notification.id)} disabled={pending} aria-label={`Mark ${notification.title} as read`}><Check size={18} /></button>}</article>
}
export function NotificationsPage() {
  const client = useQueryClient(); const list = useQuery({ queryKey: keys.list, queryFn: () => notificationService.list({ limit: 50 }) })
  const refresh = () => void client.invalidateQueries({ queryKey: ['notifications'] })
  const markRead = useMutation({ mutationFn: notificationService.markRead, onSuccess: refresh })
  const markAll = useMutation({ mutationFn: notificationService.markAllRead, onSuccess: refresh })
  const unread = list.data?.data.notifications.filter((notification) => !notification.isRead).length ?? 0
  return <div className="space-y-6"><PageHeader title="Notifications" description="Messages and account updates for your workspace." actions={<Button variant="secondary" size="sm" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}><CheckCheck size={16} />Mark all read</Button>} />{list.isLoading && <Card className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-brand-400" size={28} /></Card>}{list.isError && <ErrorState message="We could not load your notifications. Try again when the service is available." action={<Button size="sm" onClick={() => void list.refetch()}>Try again</Button>} />}{list.data && (list.data.data.notifications.length ? <Card className="overflow-hidden">{list.data.data.notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} onRead={(id) => markRead.mutate(id)} pending={markRead.isPending} />)}</Card> : <EmptyState title="No notifications" message="New account and operational notifications will appear here." action={<Bell className="mx-auto text-brand-400" />} />)}</div>
}
