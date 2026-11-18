import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function SelectField({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
