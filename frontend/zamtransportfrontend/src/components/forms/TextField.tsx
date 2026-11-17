import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
export function TextField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={cn('h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none placeholder:text-ink-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-100', className)} {...props} /> }
