import { ChevronRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { breadcrumbsFor } from '@/app/navigation'

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const items = breadcrumbsFor(pathname)
  return <nav aria-label="Breadcrumb"><ol className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink-500">{items.map((item, index) => <li className="flex items-center gap-1.5" key={`${item.label}-${index}`}>{index > 0 && <ChevronRight size={13} aria-hidden="true" />}{item.to && index < items.length - 1 ? <Link className="hover:text-brand-400" to={item.to}>{item.label}</Link> : <span aria-current={index === items.length - 1 ? 'page' : undefined} className="text-ink-700">{item.label}</span>}</li>)}</ol></nav>
}
