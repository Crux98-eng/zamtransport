import type { HTMLAttributes } from 'react'
import { CheckCircle2, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Notice({ tone = 'error', className, children, message, ...props }: HTMLAttributes<HTMLParagraphElement> & { tone?: 'error' | 'success'; message?: string }) {
  const Icon = tone === 'success' ? CheckCircle2 : CircleAlert
  return <p className={cn('flex gap-2 rounded-lg px-3 py-2 text-sm', tone === 'success' ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600', className)} role={tone === 'error' ? 'alert' : 'status'} {...props}><Icon className="mt-0.5 shrink-0" size={16} />{message ?? children}</p>
}
