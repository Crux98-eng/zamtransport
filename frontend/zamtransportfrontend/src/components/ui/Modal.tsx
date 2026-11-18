import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={modalRef}
        className={cn(
          'relative w-full rounded-2xl border border-white/10 bg-ink-50 shadow-2xl transition-all',
          sizeClasses[size],
        )}
      >
        <div className="flex items-start justify-between border-b border-ink-100 p-5 sm:p-6">
          <div className="min-w-0 pr-4">
            <h2 className="text-lg font-bold text-ink-900 sm:text-xl">{title}</h2>
            {description && <div className="mt-1 text-sm text-ink-500">{description}</div>}
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(85vh-140px)] overflow-y-auto p-5 sm:p-6 scrollbar-thin">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-ink-100 bg-ink-950/40 p-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
