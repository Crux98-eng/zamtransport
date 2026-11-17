import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) { return <section className={cn('rounded-2xl border border-ink-100/80 bg-ink-50 shadow-panel', className)} {...props} /> }
