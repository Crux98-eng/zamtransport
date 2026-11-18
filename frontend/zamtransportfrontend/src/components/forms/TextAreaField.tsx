import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function TextAreaField({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-lg border border-ink-100 bg-ink-50 p-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
