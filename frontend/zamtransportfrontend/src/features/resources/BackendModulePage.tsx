import { useQuery } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { api, apiMessage } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { ErrorState, EmptyState } from '@/components/shared/PageState'
import { PageHeader } from '@/components/shared/PageHeader'

type ModuleConfig = { title: string; description: string; endpoint: string; collection?: string }
type ApiData = Record<string, unknown>
function text(value: unknown) { if (value === null || value === undefined) return '—'; if (typeof value === 'object') return Array.isArray(value) ? `${value.length} item${value.length === 1 ? '' : 's'}` : 'Details'; return String(value) }
function rows(data: ApiData, collection?: string): Record<string, unknown>[] { const candidate = collection ? data[collection] : undefined; if (Array.isArray(candidate)) return candidate.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null); const first = Object.values(data).find((value) => Array.isArray(value)); return Array.isArray(first) ? first.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [data] }
export function BackendModulePage({ title, description, endpoint, collection }: ModuleConfig) {
  const query = useQuery({ queryKey: ['backend-module', endpoint], queryFn: async () => (await api.get<{ data: ApiData }>(endpoint)).data.data })
  const items = query.data ? rows(query.data, collection) : []; const columns = [...new Set(items.flatMap((item) => Object.keys(item)))].slice(0, 6)
  return <div className="space-y-6"><PageHeader title={title} description={description} />{query.isLoading && <Card className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-brand-400" size={28} /></Card>}{query.isError && <ErrorState message={apiMessage(query.error)} action={<button className="text-sm font-bold text-brand-400" onClick={() => void query.refetch()}>Try again</button>} />}{query.data && !items.length && <EmptyState title={`No ${title.toLowerCase()} found`} message="There are no records matching this view." />}{query.data && items.length > 0 && <Card className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-ink-950 text-xs font-bold uppercase tracking-wide text-ink-500"><tr>{columns.map((column) => <th className="px-5 py-3" key={column}>{column.replace(/([A-Z])/g, ' $1')}</th>)}</tr></thead><tbody>{items.map((item, index) => <tr className="border-t border-ink-100" key={String(item.id ?? index)}>{columns.map((column) => <td className="max-w-64 truncate px-5 py-4 text-ink-700" title={text(item[column])} key={column}>{text(item[column])}</td>)}</tr>)}</tbody></table></Card>}</div>
}
