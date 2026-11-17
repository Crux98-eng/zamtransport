import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { Card } from '@/components/ui/Card'

export function ErrorState({ title = 'Something went wrong', message, action }: { title?: string; message: string; action?: ReactNode }) {
  return <Card className="grid min-h-56 place-items-center p-6 text-center"><div><AlertTriangle className="mx-auto text-danger-500" /><h2 className="mt-3 text-lg font-bold text-ink-900">{title}</h2><p className="mt-2 max-w-md text-sm text-ink-500">{message}</p>{action && <div className="mt-4">{action}</div>}</div></Card>
}
export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return <Card className="grid min-h-56 place-items-center p-6 text-center"><div><Inbox className="mx-auto text-ink-500" /><h2 className="mt-3 text-lg font-bold text-ink-900">{title}</h2><p className="mt-2 max-w-md text-sm text-ink-500">{message}</p>{action && <div className="mt-4">{action}</div>}</div></Card>
}
