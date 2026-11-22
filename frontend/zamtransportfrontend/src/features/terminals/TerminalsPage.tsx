import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, MapPin, Plus, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState, ErrorState } from '@/components/shared/PageState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Notice } from '@/components/ui/Notice'
import { apiMessage } from '@/services/api'
import { terminalsService, type StopPayload } from '@/services/terminals'
import type { Stop } from '@/types/routes'
import { LocationPicker } from '@/features/terminals/LocationPicker'

const inputClass = 'mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400'

export function TerminalsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Stop | null>(null)
  const [values, setValues] = useState({ name: '', description: '', latitude: '', longitude: '' })
  const [selectedAddress, setSelectedAddress] = useState('')
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Stop | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const query = useQuery({
    queryKey: ['terminals', { page, search }],
    queryFn: () => terminalsService.list({ page, limit: 10, search }),
  })

  const save = useMutation({
    mutationFn: (payload: StopPayload) => editing ? terminalsService.update(editing.id, payload) : terminalsService.create(payload),
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: editing ? 'Terminal updated.' : 'Terminal created.' })
      setFormOpen(false)
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: ['terminals'] })
    },
    onError: (mutationError) => setError(apiMessage(mutationError)),
  })

  const remove = useMutation({
    mutationFn: (stopId: number) => terminalsService.delete(stopId),
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: 'Terminal deleted.' })
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['terminals'] })
    },
    onError: (mutationError) => setFeedback({ tone: 'error', message: apiMessage(mutationError) }),
  })

  function openCreate() {
    setEditing(null)
    setValues({ name: '', description: '', latitude: '', longitude: '' })
    setSelectedAddress('')
    setError('')
    setFormOpen(true)
  }

  function openEdit(stop: Stop) {
    setEditing(stop)
    setValues({ name: stop.name, description: stop.description ?? '', latitude: String(stop.latitude), longitude: String(stop.longitude) })
    setSelectedAddress('')
    setError('')
    setFormOpen(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (save.isPending) return
    const name = values.name.trim()
    const latitude = Number(values.latitude)
    const longitude = Number(values.longitude)
    if (name.length < 2 || name.length > 150) { setError('Enter a terminal name from 2 to 150 characters.'); return }
    if (values.latitude === '' || values.longitude === '') { setError('Select a location on the map before saving the terminal.'); return }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) { setError('Latitude must be from -90 to 90.'); return }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) { setError('Longitude must be from -180 to 180.'); return }
    if (values.description.length > 5000) { setError('Description cannot exceed 5000 characters.'); return }
    save.mutate({ name, description: values.description.trim() || null, latitude, longitude })
  }

  const stops = query.data?.stops ?? []
  const pagination = query.data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader title="Terminals" description="Create and maintain stops used by transport routes." actions={
        <><RefreshButton onRefresh={() => void query.refetch()} refreshing={query.isFetching} /><Button onClick={openCreate}><Plus size={16} />Add terminal</Button></>
      } />
      {feedback && <Notice tone={feedback.tone} message={feedback.message} />}
      <Card className="p-4">
        <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()) }} className="flex gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={16} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search terminal name..." className="h-11 w-full rounded-lg border border-ink-100 bg-ink-50 pl-9 pr-3 text-sm outline-none focus:border-brand-400" /></div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </Card>
      {query.isLoading && <Card className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-brand-400" size={28} /></Card>}
      {query.isError && <ErrorState message={apiMessage(query.error)} action={<button className="text-sm font-bold text-brand-400" onClick={() => void query.refetch()}>Try again</button>} />}
      {query.data && stops.length === 0 && <EmptyState title="No terminals found" message="Create a terminal or adjust your search." />}
      {stops.length > 0 && <Card className="overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-ink-950 text-xs uppercase tracking-wide text-ink-500"><tr><th className="px-5 py-3">Terminal</th><th className="px-5 py-3">Coordinates</th><th className="px-5 py-3">Description</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
          <tbody>{stops.map((stop) => <tr key={stop.id} className="border-t border-ink-100"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/10 text-brand-400"><MapPin size={16} /></span><div><p className="font-semibold text-ink-900">{stop.name}</p><Badge tone="neutral">ID {stop.id}</Badge></div></div></td><td className="px-5 py-4 font-mono text-xs text-ink-600">{stop.latitude}, {stop.longitude}</td><td className="max-w-sm px-5 py-4 text-ink-600">{stop.description || '—'}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={() => openEdit(stop)}>Edit</Button><button className="grid h-9 w-9 place-items-center rounded-lg text-danger-500 hover:bg-danger-500/10" onClick={() => setDeleteTarget(stop)} aria-label={`Delete ${stop.name}`}><Trash2 size={16} /></button></div></td></tr>)}</tbody>
        </table>
        </div>
      </Card>}
      {pagination && pagination.totalPages > 1 && <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="grid h-9 place-items-center px-2 text-sm text-ink-500">{page} / {pagination.totalPages}</span><Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div>}

      <Modal isOpen={formOpen} onClose={() => { if (!save.isPending) setFormOpen(false) }} title={editing ? 'Edit terminal' : 'Add terminal'} size="2xl" footer={<><Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={save.isPending}>Cancel</Button><Button type="submit" form="terminal-form" disabled={save.isPending}>{save.isPending ? 'Saving...' : 'Save terminal'}</Button></>}>
        <form id="terminal-form" onSubmit={submit} className="space-y-4">
          {error && <Notice tone="error" message={error} />}
          <div><label className="text-sm font-semibold text-ink-700">Name</label><input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} className={inputClass} /></div>
          <div><label className="text-sm font-semibold text-ink-700">Description</label><textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} className="mt-1.5 min-h-24 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-sm outline-none focus:border-brand-400" /></div>
          <div>
            <label className="text-sm font-semibold text-ink-700">Location</label>
            <div className="mt-1.5">
              <LocationPicker
                latitude={values.latitude}
                longitude={values.longitude}
                address={selectedAddress}
                onAddressChange={setSelectedAddress}
                onChange={(latitude, longitude, address) => {
                  setValues({ ...values, latitude: String(latitude), longitude: String(longitude) })
                  if (address) setSelectedAddress(address)
                }}
                onClear={() => {
                  setValues({ ...values, latitude: '', longitude: '' })
                  setSelectedAddress('')
                }}
              />
            </div>
          </div>
        </form>
      </Modal>
      <Modal isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete terminal" description="This cannot be undone. Terminals attached to routes must be removed from those routes first." footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button className="bg-danger-500 hover:bg-danger-500" onClick={() => deleteTarget && remove.mutate(deleteTarget.id)} disabled={remove.isPending}>Delete terminal</Button></>}><p className="text-sm text-ink-700">Delete <strong>{deleteTarget?.name}</strong>?</p></Modal>
    </div>
  )
}
