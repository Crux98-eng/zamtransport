import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'
export function Badge({ className, tone = 'neutral', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const tones: Record<Tone, string> = { success: 'bg-success-50 text-success-600', warning: 'bg-warning-50 text-warning-500', danger: 'bg-danger-50 text-danger-600', neutral: 'bg-ink-100 text-ink-500', info: 'bg-brand-50 text-brand-600' }
  return <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold', tones[tone], className)} {...props} />
}
