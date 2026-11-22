import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState, ErrorState } from '@/components/shared/PageState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Notice } from '@/components/ui/Notice'
import { apiMessage } from '@/services/api'
import { tripsService } from '@/services/trips'
import { schedulesService } from '@/services/schedules'
import { driversService } from '@/services/drivers'
import { vehiclesService } from '@/services/vehicles'
import type { Trip, TripStatus } from '@/types/trips'

const statuses: TripStatus[] = ['SCHEDULED', 'BOARDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED']
const inputClass = 'mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400'

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Unavailable'
}

function toDateTimeInput(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function statusTone(status: TripStatus) {
  if (status === 'COMPLETED') return 'success' as const
  if (status === 'CANCELLED') return 'danger' as const
  if (status === 'DELAYED') return 'warning' as const
  if (status === 'IN_PROGRESS' || status === 'BOARDING') return 'info' as const
  return 'neutral' as const
}

export function TripsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [tripCode, setTripCode] = useState('')
  const [statusFilter, setStatusFilter] = useState<TripStatus | 'ALL'>('ALL')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Trip | null>(null)
  const [assignTarget, setAssignTarget] = useState<Trip | null>(null)
  const [statusTarget, setStatusTarget] = useState<Trip | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [formError, setFormError] = useState('')
  const [createValues, setCreateValues] = useState({ scheduleId: '', tripCode: '', departure: '', arrival: '', driverId: '', vehicleId: '' })
  const [editValues, setEditValues] = useState({ tripCode: '', departure: '', arrival: '' })
  const [assignment, setAssignment] = useState({ driverId: '', vehicleId: '' })
  const [statusValue, setStatusValue] = useState<TripStatus>('SCHEDULED')
  const [statusReason, setStatusReason] = useState('')

  const tripsQuery = useQuery({
    queryKey: ['trips', { page, tripCode, statusFilter }],
    queryFn: () => tripsService.list({ page, limit: 10, tripCode, ...(statusFilter === 'ALL' ? {} : { tripStatus: statusFilter }) }),
  })
  const schedulesQuery = useQuery({
    queryKey: ['trips', 'active-schedules'],
    queryFn: async () => {
      const first = await schedulesService.list({ page: 1, limit: 100, status: 'ACTIVE' })
      return first.schedules
    },
  })
  const driversQuery = useQuery({
    queryKey: ['trips', 'active-drivers'],
    queryFn: () => driversService.list({ page: 1, limit: 100 }),
  })
  const vehiclesQuery = useQuery({
    queryKey: ['trips', 'active-vehicles'],
    queryFn: () => vehiclesService.list({ page: 1, limit: 100, status: 'ACTIVE' }),
  })

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['trips'] })

  const createMutation = useMutation({
    mutationFn: () => tripsService.create({
      scheduleId: Number(createValues.scheduleId),
      tripCode: createValues.tripCode.trim() || null,
      scheduledDeparture: new Date(createValues.departure).toISOString(),
      scheduledArrival: new Date(createValues.arrival).toISOString(),
      ...(createValues.driverId && createValues.vehicleId ? { driverId: Number(createValues.driverId), vehicleId: Number(createValues.vehicleId) } : {}),
    }),
    onSuccess: async () => { setFeedback({ tone: 'success', message: 'Trip created.' }); setCreateOpen(false); await refresh() },
    onError: (error) => setFormError(apiMessage(error)),
  })

  const editMutation = useMutation({
    mutationFn: () => editTarget ? tripsService.update(editTarget.id, {
      tripCode: editValues.tripCode.trim() || null,
      scheduledDeparture: new Date(editValues.departure).toISOString(),
      scheduledArrival: new Date(editValues.arrival).toISOString(),
    }) : Promise.reject(new Error('No trip selected')),
    onSuccess: async () => { setFeedback({ tone: 'success', message: 'Trip updated.' }); setEditTarget(null); await refresh() },
    onError: (error) => setFormError(apiMessage(error)),
  })

  const assignMutation = useMutation({
    mutationFn: () => assignTarget ? tripsService.assign(assignTarget.id, Number(assignment.driverId), Number(assignment.vehicleId)) : Promise.reject(new Error('No trip selected')),
    onSuccess: async () => { setFeedback({ tone: 'success', message: 'Trip assignment updated.' }); setAssignTarget(null); await refresh() },
    onError: (error) => setFormError(apiMessage(error)),
  })

  const statusMutation = useMutation({
    mutationFn: () => statusTarget ? tripsService.updateStatus(statusTarget.id, { status: statusValue, ...(statusValue === 'DELAYED' || statusValue === 'CANCELLED' ? { reason: statusReason } : {}) }) : Promise.reject(new Error('No trip selected')),
    onSuccess: async () => { setFeedback({ tone: 'success', message: 'Trip status updated.' }); setStatusTarget(null); await refresh() },
    onError: (error) => setFormError(apiMessage(error)),
  })

  function openCreate() {
    setCreateValues({ scheduleId: '', tripCode: '', departure: '', arrival: '', driverId: '', vehicleId: '' })
    setFormError('')
    setCreateOpen(true)
  }
  function openEdit(trip: Trip) {
    setEditTarget(trip)
    setEditValues({ tripCode: trip.tripCode ?? '', departure: toDateTimeInput(trip.scheduledDeparture), arrival: toDateTimeInput(trip.scheduledArrival) })
    setFormError('')
  }
  function openAssign(trip: Trip) {
    setAssignTarget(trip)
    setAssignment({ driverId: trip.driverId ? String(trip.driverId) : '', vehicleId: trip.vehicleId ? String(trip.vehicleId) : '' })
    setFormError('')
  }

  function validateTimes(departure: string, arrival: string) {
    if (!departure || !arrival) return 'Choose a scheduled departure and arrival.'
    if (new Date(arrival) <= new Date(departure)) return 'Scheduled arrival must be after departure.'
    return ''
  }
  function submitCreate(event?: FormEvent) {
    event?.preventDefault()
    const error = !createValues.scheduleId ? 'Select a schedule.' : validateTimes(createValues.departure, createValues.arrival)
    if (error) { setFormError(error); return }
    if ((createValues.driverId && !createValues.vehicleId) || (!createValues.driverId && createValues.vehicleId)) { setFormError('Driver and vehicle must be assigned together.'); return }
    setFormError('')
    createMutation.mutate()
  }

  const trips = tripsQuery.data?.trips ?? []
  const pagination = tripsQuery.data?.pagination
  const activeSchedules = schedulesQuery.data ?? []
  const activeDrivers = driversQuery.data?.data.drivers.filter((driver) => driver.status === 'ACTIVE') ?? []
  const activeVehicles = vehiclesQuery.data?.data.vehicles.filter((vehicle) => vehicle.status === 'ACTIVE') ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Trips" description="Manage scheduled operations, assignments, and trip lifecycle." actions={<><RefreshButton onRefresh={refresh} refreshing={tripsQuery.isFetching} /><Button onClick={openCreate}><Plus size={16} />Create trip</Button></>} />
      {feedback && <Notice tone={feedback.tone} message={feedback.message} />}
      <Card className="p-4"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={16} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage(1); setTripCode(searchInput.trim()) } }} placeholder="Search trip code..." className="h-11 w-full rounded-lg border border-ink-100 bg-ink-50 pl-9 pr-3 text-sm outline-none focus:border-brand-400" /></div><select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value as TripStatus | 'ALL') }} className="h-11 rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm"><option value="ALL">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><Button variant="secondary" onClick={() => { setPage(1); setTripCode(searchInput.trim()) }}>Search</Button></div></Card>
      {tripsQuery.isLoading && <Card className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-brand-400" size={28} /></Card>}
      {tripsQuery.isError && <ErrorState message={apiMessage(tripsQuery.error)} action={<button className="text-sm font-bold text-brand-400" onClick={() => void tripsQuery.refetch()}>Try again</button>} />}
      {tripsQuery.data && trips.length === 0 && <EmptyState title="No trips found" message="Create a trip or adjust the filters." />}
      {trips.length > 0 && <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-ink-950 text-xs uppercase tracking-wide text-ink-500"><tr><th className="px-5 py-3">Trip</th><th className="px-5 py-3">Route</th><th className="px-5 py-3">Schedule</th><th className="px-5 py-3">Assignment</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody>{trips.map((trip) => <tr key={trip.id} className="border-t border-ink-100"><td className="px-5 py-4"><p className="font-semibold text-ink-900">{trip.tripCode || `TRP-${trip.id}`}</p><p className="mt-1 text-xs text-ink-500">{formatDate(trip.scheduledDeparture)} → {formatDate(trip.scheduledArrival)}</p></td><td className="px-5 py-4 text-ink-700">{trip.route ? `${trip.route.origin} → ${trip.route.destination}` : `Route ${trip.routeId}`}</td><td className="px-5 py-4 text-ink-600">Schedule {trip.scheduleId}</td><td className="px-5 py-4 text-ink-600">{trip.driver?.fullName || 'Unassigned'}<br /><span className="text-xs">{trip.vehicle?.registrationNumber || 'No vehicle'}</span></td><td className="px-5 py-4"><Badge tone={statusTone(trip.status)}>{trip.status}</Badge></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button variant="secondary" size="sm" disabled={trip.status === 'COMPLETED' || trip.status === 'CANCELLED'} onClick={() => openEdit(trip)}>Edit</Button><Button variant="secondary" size="sm" disabled={trip.status === 'COMPLETED' || trip.status === 'CANCELLED'} onClick={() => openAssign(trip)}>Assign</Button><Button variant="secondary" size="sm" onClick={() => { setStatusTarget(trip); setStatusValue(trip.status); setStatusReason(''); setFormError('') }}>Status</Button></div></td></tr>)}</tbody></table></div></Card>}
      {pagination && pagination.totalPages > 1 && <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="grid h-9 place-items-center px-2 text-sm text-ink-500">{page} / {pagination.totalPages}</span><Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div>}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create trip" size="xl" footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => submitCreate()} disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create trip'}</Button></>}>
        <form onSubmit={submitCreate} className="space-y-4">{formError && <Notice tone="error" message={formError} />}<div><label className="text-sm font-semibold text-ink-700">Schedule</label><select value={createValues.scheduleId} onChange={(event) => setCreateValues({ ...createValues, scheduleId: event.target.value })} className={inputClass}><option value="">Select active schedule</option>{activeSchedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.route.name} · {schedule.route.origin} to {schedule.route.destination}</option>)}</select></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-semibold text-ink-700">Departure</label><input type="datetime-local" value={createValues.departure} onChange={(event) => setCreateValues({ ...createValues, departure: event.target.value })} className={inputClass} /></div><div><label className="text-sm font-semibold text-ink-700">Arrival</label><input type="datetime-local" value={createValues.arrival} onChange={(event) => setCreateValues({ ...createValues, arrival: event.target.value })} className={inputClass} /></div></div><div><label className="text-sm font-semibold text-ink-700">Trip code (optional)</label><input value={createValues.tripCode} onChange={(event) => setCreateValues({ ...createValues, tripCode: event.target.value })} className={inputClass} /></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-semibold text-ink-700">Driver (optional)</label><select value={createValues.driverId} onChange={(event) => setCreateValues({ ...createValues, driverId: event.target.value })} className={inputClass}><option value="">Unassigned</option>{activeDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.fullName}</option>)}</select></div><div><label className="text-sm font-semibold text-ink-700">Vehicle (optional)</label><select value={createValues.vehicleId} onChange={(event) => setCreateValues({ ...createValues, vehicleId: event.target.value })} className={inputClass}><option value="">Unassigned</option>{activeVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber}</option>)}</select></div></div></form>
      </Modal>

      <Modal isOpen={Boolean(editTarget)} onClose={() => setEditTarget(null)} title="Edit trip" footer={<><Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button><Button onClick={() => { const error = validateTimes(editValues.departure, editValues.arrival); if (error) { setFormError(error); return } setFormError(''); editMutation.mutate() }} disabled={editMutation.isPending}>Save</Button></>}>
        {formError && <Notice tone="error" message={formError} />}<div className="mt-4 space-y-4"><div><label className="text-sm font-semibold text-ink-700">Trip code</label><input value={editValues.tripCode} onChange={(event) => setEditValues({ ...editValues, tripCode: event.target.value })} className={inputClass} /></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-semibold text-ink-700">Departure</label><input type="datetime-local" value={editValues.departure} onChange={(event) => setEditValues({ ...editValues, departure: event.target.value })} className={inputClass} /></div><div><label className="text-sm font-semibold text-ink-700">Arrival</label><input type="datetime-local" value={editValues.arrival} onChange={(event) => setEditValues({ ...editValues, arrival: event.target.value })} className={inputClass} /></div></div></div>
      </Modal>

      <Modal isOpen={Boolean(assignTarget)} onClose={() => setAssignTarget(null)} title="Assign trip" footer={<><Button variant="secondary" onClick={() => setAssignTarget(null)}>Cancel</Button><Button onClick={() => { if (!assignment.driverId || !assignment.vehicleId) { setFormError('Select both a driver and vehicle.'); return } setFormError(''); assignMutation.mutate() }} disabled={assignMutation.isPending}>Assign</Button></>}>
        {formError && <Notice tone="error" message={formError} />}<div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-semibold text-ink-700">Driver</label><select value={assignment.driverId} onChange={(event) => setAssignment({ ...assignment, driverId: event.target.value })} className={inputClass}><option value="">Select driver</option>{activeDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.fullName}</option>)}</select></div><div><label className="text-sm font-semibold text-ink-700">Vehicle</label><select value={assignment.vehicleId} onChange={(event) => setAssignment({ ...assignment, vehicleId: event.target.value })} className={inputClass}><option value="">Select vehicle</option>{activeVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber}</option>)}</select></div></div>
      </Modal>

      <Modal isOpen={Boolean(statusTarget)} onClose={() => setStatusTarget(null)} title="Change trip status" footer={<><Button variant="secondary" onClick={() => setStatusTarget(null)}>Cancel</Button><Button onClick={() => { if ((statusValue === 'DELAYED' || statusValue === 'CANCELLED') && statusReason.trim().length < 2) { setFormError('Enter a reason of at least 2 characters.'); return } setFormError(''); statusMutation.mutate() }} disabled={statusMutation.isPending}>Update status</Button></>}>
        {formError && <Notice tone="error" message={formError} />}<div className="mt-4 space-y-4"><div><label className="text-sm font-semibold text-ink-700">Status</label><select value={statusValue} onChange={(event) => setStatusValue(event.target.value as TripStatus)} className={inputClass}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>{(statusValue === 'DELAYED' || statusValue === 'CANCELLED') && <div><label className="text-sm font-semibold text-ink-700">Reason</label><textarea value={statusReason} onChange={(event) => setStatusReason(event.target.value)} className="mt-1.5 min-h-24 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-sm" /></div>}</div>
      </Modal>
    </div>
  )
}
