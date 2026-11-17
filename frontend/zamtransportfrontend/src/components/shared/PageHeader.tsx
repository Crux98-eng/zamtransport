import type { ReactNode } from 'react'
import { Breadcrumbs } from '@/components/shared/Breadcrumbs'

export function PageHeader({ title, description, actions, status }: { title: string; description?: string; actions?: ReactNode; status?: ReactNode }) {
  return <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Breadcrumbs /><div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>{status}</div>{description && <p className="mt-1 text-sm text-ink-500">{description}</p>}</div>{actions && <div className="shrink-0">{actions}</div>}</header>
}
