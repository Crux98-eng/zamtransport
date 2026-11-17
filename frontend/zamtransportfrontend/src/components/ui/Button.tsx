import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md' }
export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return <button className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-ink-950 disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4 text-sm', variant === 'primary' && 'bg-brand-500 text-white shadow-[0_10px_28px_rgba(255,90,43,.24)] hover:bg-brand-400', variant === 'secondary' && 'border border-ink-100 bg-ink-50 text-ink-700 hover:bg-ink-100', variant === 'ghost' && 'text-ink-500 hover:bg-ink-100 hover:text-ink-900', className)} {...props} />
}
