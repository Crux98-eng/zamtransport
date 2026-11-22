import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Plus,
  Route as RouteIcon,
  Search,
  WandSparkles,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState } from '@/components/shared/PageState'
import { PageHeader } from '@/components/shared/PageHeader'
import { schedulesService } from '@/services/schedules'
import { apiMessage } from '@/services/api'
import { scheduleDays, type Schedule, type ScheduleDayName, type SchedulePayload, type ScheduleRoute, type ScheduleStatus } from '@/types/schedules'

type ScheduleFormValues = {
  routeId: string
  description: string
  departureTime: string
  estimatedDuration: string
  effectiveFrom: string
  effectiveUntil: string
  days: ScheduleDayName[]
}

type FormErrors = Partial<Record<keyof ScheduleFormValues, string>>
type SaveVariables =
  | { scheduleId: null; payload: SchedulePayload }
  | { scheduleId: number; payload: Partial<SchedulePayload> }

const dayLabels: Record<ScheduleDayName, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
}

function lusakaDate(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function dateInputValue(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : ''
}

function timeInputValue(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(11, 16) : ''
}

function formatDate(value: string | null) {
  if (!value) return 'No end date'
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'Africa/Lusaka' }).format(date)
    : 'Date unavailable'
}

function initialForm(schedule?: Schedule | null): ScheduleFormValues {
  if (!schedule) {
    return {
      routeId: '',
      description: '',
      departureTime: '08:00',
      estimatedDuration: '90',
      effectiveFrom: lusakaDate(new Date()),
      effectiveUntil: '',
      days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    }
  }
  return {
    routeId: String(schedule.routeId),
    description: schedule.description ?? '',
    departureTime: timeInputValue(schedule.departureTime),
    estimatedDuration: String(schedule.estimatedDuration),
    effectiveFrom: dateInputValue(schedule.effectiveFrom),
    effectiveUntil: dateInputValue(schedule.effectiveUntil ?? ''),
    days: schedule.days.map(({ dayOfWeek }) => dayOfWeek),
  }
}

function validateScheduleForm(values: ScheduleFormValues): FormErrors {
  const errors: FormErrors = {}
  const routeId = Number(values.routeId)
  const duration = Number(values.estimatedDuration)
  if (!Number.isInteger(routeId) || routeId < 1) errors.routeId = 'Select an active route.'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.departureTime)) errors.departureTime = 'Use 24-hour HH:mm time.'
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) errors.estimatedDuration = 'Enter a whole number from 1 to 1440 minutes.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.effectiveFrom)) errors.effectiveFrom = 'Choose a start date.'
  if (values.effectiveUntil && !/^\d{4}-\d{2}-\d{2}$/.test(values.effectiveUntil)) errors.effectiveUntil = 'Choose a valid end date.'
  if (values.effectiveUntil && values.effectiveFrom && values.effectiveUntil < values.effectiveFrom) errors.effectiveUntil = 'End date must be on or after the start date.'
  if (values.days.length === 0) errors.days = 'Choose at least one operating day.'
  if (values.days.length !== new Set(values.days).size) errors.days = 'Operating days must be unique.'
  if (values.description.trim().length > 1000) errors.description = 'Description cannot exceed 1000 characters.'
  return errors
}

function routeLabel(route: ScheduleRoute) {
  return `${route.name} · ${route.origin} to ${route.destination}`
}

export function SchedulesPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | 'ALL'>('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [formValues, setFormValues] = useState<ScheduleFormValues>(() => initialForm())
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [generationStart, setGenerationStart] = useState(() => lusakaDate(new Date()))
  const [generationEnd, setGenerationEnd] = useState(() => addDays(lusakaDate(new Date()), 7))
  const [generationSchedule, setGenerationSchedule] = useState('')
  const [generationResult, setGenerationResult] = useState<Awaited<ReturnType<typeof schedulesService.generateTrips>> | null>(null)

  const schedulesQuery = useQuery({
    queryKey: ['schedules', 'list', { page, search, statusFilter }],
    queryFn: () => schedulesService.list({
      page,
      limit: 10,
      search,
      ...(statusFilter === 'ALL' ? {} : { status: statusFilter }),
    }),
  })

  const routesQuery = useQuery({
    queryKey: ['schedules', 'active-routes'],
    queryFn: async () => {
      const firstPage = await schedulesService.listRoutes(1)
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.pagination.totalPages - 1) }, (_, index) => schedulesService.listRoutes(index + 2)),
      )
      return [...firstPage.routes, ...remainingPages.flatMap((result) => result.routes)]
    },
  })

  const activeSchedulesQuery = useQuery({
    queryKey: ['schedules', 'active-for-generation'],
    queryFn: async () => {
      const firstPage = await schedulesService.list({ page: 1, limit: 100, status: 'ACTIVE' })
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.pagination.totalPages - 1) }, (_, index) =>
          schedulesService.list({ page: index + 2, limit: 100, status: 'ACTIVE' }),
        ),
      )
      return [...firstPage.schedules, ...remainingPages.flatMap((result) => result.schedules)]
    },
  })

  const refreshSchedules = () => {
    void queryClient.invalidateQueries({ queryKey: ['schedules'] })
  }

  const saveMutation = useMutation({
    mutationFn: ({ scheduleId, payload }: SaveVariables) => scheduleId === null
      ? schedulesService.create(payload)
      : schedulesService.update(scheduleId, payload),
    onSuccess: async (_schedule, variables) => {
      setFeedback({ tone: 'success', message: variables.scheduleId ? 'Schedule updated.' : 'Schedule created.' })
      setFormOpen(false)
      setEditingSchedule(null)
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => setFeedback({ tone: 'error', message: apiMessage(error) }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ scheduleId, status }: { scheduleId: number; status: ScheduleStatus }) =>
      schedulesService.updateStatus(scheduleId, status),
    onSuccess: async (_schedule, variables) => {
      setFeedback({ tone: 'success', message: `Schedule set to ${variables.status.toLowerCase()}.` })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => setFeedback({ tone: 'error', message: apiMessage(error) }),
  })

  const deleteMutation = useMutation({
    mutationFn: (scheduleId: number) => schedulesService.delete(scheduleId),
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: 'Schedule deleted.' })
      setDeleteTarget(null)
      if (page > 1 && schedules.length <= 1) setPage((current) => Math.max(1, current - 1))
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => setFeedback({ tone: 'error', message: apiMessage(error) }),
  })

  const generateMutation = useMutation({
    mutationFn: schedulesService.generateTrips,
    onSuccess: async (result) => {
      setGenerationResult(result)
      setFeedback({ tone: 'success', message: 'Trip generation completed.' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['schedules'] }),
        queryClient.invalidateQueries({ queryKey: ['backend-module', '/admin/trips'] }),
      ])
    },
    onError: (error) => setFeedback({ tone: 'error', message: apiMessage(error) }),
  })

  const schedules = schedulesQuery.data?.schedules ?? []
  const pagination = schedulesQuery.data?.pagination
  const routes = routesQuery.data ?? []
  const anyMutationPending = saveMutation.isPending || statusMutation.isPending || deleteMutation.isPending || generateMutation.isPending

  function openCreateForm() {
    setEditingSchedule(null)
    setFormValues(initialForm())
    setFormErrors({})
    setFormOpen(true)
    setFeedback(null)
  }

  function openEditForm(schedule: Schedule) {
    setEditingSchedule(schedule)
    setFormValues(initialForm(schedule))
    setFormErrors({})
    setFormOpen(true)
    setFeedback(null)
  }

  function closeForm() {
    if (saveMutation.isPending) return
    setFormOpen(false)
    setEditingSchedule(null)
    setFormErrors({})
  }

  function updateForm<K extends keyof ScheduleFormValues>(key: K, value: ScheduleFormValues[K]) {
    setFormValues((current) => ({ ...current, [key]: value }))
    setFormErrors((current) => ({ ...current, [key]: undefined }))
  }

  function submitSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateScheduleForm(formValues)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    const payload: SchedulePayload = {
      routeId: Number(formValues.routeId),
      description: formValues.description.trim() || null,
      departureTime: formValues.departureTime,
      estimatedDuration: Number(formValues.estimatedDuration),
      effectiveFrom: formValues.effectiveFrom,
      effectiveUntil: formValues.effectiveUntil || null,
      days: formValues.days,
    }
    if (editingSchedule && editingSchedule.route.status !== 'ACTIVE' && editingSchedule.routeId === payload.routeId) {
      const { routeId: _routeId, ...scheduleFields } = payload
      saveMutation.mutate({ scheduleId: editingSchedule.id, payload: scheduleFields })
      return
    }
    if (editingSchedule) {
      saveMutation.mutate({ scheduleId: editingSchedule.id, payload })
      return
    }
    saveMutation.mutate({ scheduleId: null, payload })
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
    setFeedback(null)
  }

  function submitGeneration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!generationStart || !generationEnd || generationEnd < generationStart) {
      setFeedback({ tone: 'error', message: 'Choose a valid date range; the end date must be on or after the start date.' })
      return
    }
    setFeedback(null)
    setGenerationResult(null)
    generateMutation.mutate({
      ...(generationSchedule ? { scheduleId: Number(generationSchedule) } : {}),
      startDate: generationStart,
      endDate: generationEnd,
    })
  }

  function toggleDay(day: ScheduleDayName) {
    const days = formValues.days.includes(day)
      ? formValues.days.filter((value) => value !== day)
      : [...formValues.days, day]
    updateForm('days', days)
  }

  const availableRoutes = editingSchedule && !routes.some((route) => route.id === editingSchedule.routeId)
    ? [...routes, editingSchedule.route]
    : routes

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        description="Manage recurring services and generate trips from active schedules."
        status={pagination && <Badge tone="info">{pagination.total} schedules</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton size="sm" onRefresh={refreshSchedules} refreshing={schedulesQuery.isFetching} />
            <Button onClick={openCreateForm} disabled={routesQuery.isError || routes.length === 0}>
              <Plus size={17} /> New schedule
            </Button>
          </div>
        }
      />

      {feedback && <Notice tone={feedback.tone === 'success' ? 'success' : 'error'}>{feedback.message}</Notice>}
      {routesQuery.isError && <Notice>Active routes could not be loaded: {apiMessage(routesQuery.error)}</Notice>}

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <WandSparkles size={18} className="text-brand-500" />
          <div>
            <h2 className="font-bold text-ink-900">Generate trips</h2>
            <p className="text-xs text-ink-500">The backend applies schedule dates and weekdays in Africa/Lusaka time.</p>
          </div>
        </div>
        <form onSubmit={submitGeneration} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px_auto] xl:items-end">
          <label className="block text-sm font-semibold text-ink-700">
            Schedule
            <select
              value={generationSchedule}
              onChange={(event) => setGenerationSchedule(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400"
            >
              <option value="">All active schedules</option>
              {(activeSchedulesQuery.data ?? []).map((schedule) => (
                <option key={schedule.id} value={schedule.id}>{schedule.route.name} · {timeInputValue(schedule.departureTime)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-ink-700">
            Start date
            <input type="date" required value={generationStart} onChange={(event) => setGenerationStart(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400" />
          </label>
          <label className="block text-sm font-semibold text-ink-700">
            End date
            <input type="date" required min={generationStart} value={generationEnd} onChange={(event) => setGenerationEnd(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400" />
          </label>
          <Button type="submit" disabled={generateMutation.isPending || activeSchedulesQuery.isLoading || (activeSchedulesQuery.data?.length ?? 0) === 0}>
            {generateMutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <CalendarDays size={16} />}
            Generate trips
          </Button>
        </form>
        {activeSchedulesQuery.isError && <p role="alert" className="mt-3 text-sm text-danger-500">Could not load active schedules: {apiMessage(activeSchedulesQuery.error)}</p>}
        {activeSchedulesQuery.data?.length === 0 && <p className="mt-3 text-sm text-ink-500">Create or activate a schedule before generating trips.</p>}
        {generationResult && (
          <div role="status" className="mt-4 grid gap-2 rounded-xl bg-success-50 p-4 text-sm text-success-700 sm:grid-cols-3">
            <p><strong>{generationResult.schedulesProcessed}</strong> schedules processed</p>
            <p><strong>{generationResult.generated}</strong> trips generated</p>
            <p><strong>{generationResult.skippedDuplicates}</strong> duplicate trips skipped</p>
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <form onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
          <label className="relative block min-w-0">
            <span className="sr-only">Search schedules</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search route or description" className="h-11 w-full rounded-lg border border-ink-100 bg-ink-50 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-400" />
          </label>
          <label>
            <span className="sr-only">Filter by schedule status</span>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as ScheduleStatus | 'ALL'); setPage(1) }} className="h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400">
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <Button type="submit" variant="secondary"><Search size={16} /> Search</Button>
        </form>
      </Card>

      {schedulesQuery.isLoading && (
        <Card className="grid min-h-56 place-items-center text-ink-500">
          <span className="flex items-center gap-2"><LoaderCircle size={20} className="animate-spin" /> Loading schedules…</span>
        </Card>
      )}
      {schedulesQuery.isError && (
        <ErrorState title="Could not load schedules" message={apiMessage(schedulesQuery.error)} action={<Button variant="secondary" onClick={() => void schedulesQuery.refetch()}>Try again</Button>} />
      )}
      {schedulesQuery.data && schedules.length === 0 && (
        <EmptyState
          title={search || statusFilter !== 'ALL' ? 'No matching schedules' : 'No schedules yet'}
          message={search || statusFilter !== 'ALL' ? 'Adjust the search or status filter.' : 'Create a schedule to define recurring service and generate trips.'}
          action={!search && statusFilter === 'ALL' ? <Button onClick={openCreateForm}><Plus size={16} /> Create schedule</Button> : undefined}
        />
      )}

      {schedulesQuery.data && schedules.length > 0 && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {schedules.map((schedule) => {
              const isBusy = statusMutation.isPending && statusMutation.variables?.scheduleId === schedule.id
              const deleteBusy = deleteMutation.isPending && deleteTarget?.id === schedule.id
              return (
                <Card key={schedule.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-ink-900">{schedule.route.name}</h2>
                        <Badge tone={schedule.status === 'ACTIVE' ? 'success' : 'neutral'}>{schedule.status}</Badge>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                        <RouteIcon size={15} /> {schedule.route.origin} to {schedule.route.destination}
                      </p>
                    </div>
                    <span className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-bold text-brand-600">
                      {timeInputValue(schedule.departureTime)}
                    </span>
                  </div>

                  {schedule.description && <p className="mt-3 text-sm text-ink-600">{schedule.description}</p>}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {scheduleDays.map((day) => {
                      const enabled = schedule.days.some((item) => item.dayOfWeek === day)
                      return <span key={day} className={`rounded-md px-2 py-1 text-xs font-semibold ${enabled ? 'bg-brand-50 text-brand-600' : 'bg-ink-950 text-ink-400'}`}>{dayLabels[day]}</span>
                    })}
                  </div>
                  <div className="mt-4 grid gap-2 border-t border-ink-100 pt-4 text-sm sm:grid-cols-2">
                    <p className="flex items-center gap-2 text-ink-600"><Clock3 size={15} /> {schedule.estimatedDuration} min estimated</p>
                    <p className="flex items-center gap-2 text-ink-600"><CalendarDays size={15} /> {schedule._count?.trips ?? 0} generated trips</p>
                    <p className="text-xs text-ink-500">Effective {formatDate(schedule.effectiveFrom)} – {formatDate(schedule.effectiveUntil)}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-4">
                    <Button variant="secondary" size="sm" onClick={() => statusMutation.mutate({ scheduleId: schedule.id, status: schedule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })} disabled={statusMutation.isPending || saveMutation.isPending}>
                      {isBusy && <LoaderCircle size={15} className="animate-spin" />}
                      {schedule.status === 'ACTIVE' ? 'Set inactive' : 'Activate'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => openEditForm(schedule)} disabled={anyMutationPending}>Edit</Button>
                    {schedule._count?.trips ? (
                      <span className="self-center text-xs text-ink-500">Has trips; deactivate instead</span>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(schedule)} disabled={deleteBusy || anyMutationPending}>
                        {deleteBusy && <LoaderCircle size={15} className="animate-spin" />} Delete
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-500">
              Showing {(pagination!.page - 1) * pagination!.limit + 1}–{Math.min(pagination!.page * pagination!.limit, pagination!.total)} of {pagination!.total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || schedulesQuery.isFetching}>
                <ChevronLeft size={16} /> Previous
              </Button>
              <span className="px-2 text-sm text-ink-500">Page {pagination!.page} of {Math.max(pagination!.totalPages, 1)}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage((current) => current + 1)} disabled={schedulesQuery.isFetching || page >= pagination!.totalPages}>
                Next <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editingSchedule ? 'Edit schedule' : 'Create schedule'}
        description="Departure times are interpreted in Africa/Lusaka (UTC+02:00)."
        size="xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeForm} disabled={saveMutation.isPending}>Cancel</Button>
            <Button type="submit" form="schedule-form" disabled={saveMutation.isPending || routesQuery.isLoading}>
              {saveMutation.isPending && <LoaderCircle size={16} className="animate-spin" />}
              {editingSchedule ? 'Save changes' : 'Create schedule'}
            </Button>
          </>
        }
      >
        <form id="schedule-form" onSubmit={submitSchedule} className="space-y-4" noValidate>
          {saveMutation.isError && <Notice>{apiMessage(saveMutation.error)}</Notice>}
          {routesQuery.isError && <Notice>Active route options could not be loaded: {apiMessage(routesQuery.error)}</Notice>}
          <div>
            <label htmlFor="schedule-route" className="block text-sm font-semibold text-ink-700">Route *</label>
            <select id="schedule-route" value={formValues.routeId} onChange={(event) => updateForm('routeId', event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400">
              <option value="">Select a route</option>
              {availableRoutes.map((route) => <option key={route.id} value={route.id}>{routeLabel(route)}{route.status !== 'ACTIVE' ? ' (inactive)' : ''}</option>)}
            </select>
            {formErrors.routeId && <p className="mt-1 text-xs text-danger-500">{formErrors.routeId}</p>}
            {editingSchedule?.route.status === 'INACTIVE' && formValues.routeId === String(editingSchedule.routeId) && (
              <p className="mt-1 text-xs text-warning-600">This route is inactive. Keep it unchanged or choose an active route before saving.</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="schedule-departure" className="block text-sm font-semibold text-ink-700">Departure time *</label>
              <input id="schedule-departure" type="time" value={formValues.departureTime} onChange={(event) => updateForm('departureTime', event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400" />
              {formErrors.departureTime && <p className="mt-1 text-xs text-danger-500">{formErrors.departureTime}</p>}
            </div>
            <div>
              <label htmlFor="schedule-duration" className="block text-sm font-semibold text-ink-700">Estimated duration (minutes) *</label>
              <input id="schedule-duration" type="number" min={1} max={1440} step={1} value={formValues.estimatedDuration} onChange={(event) => updateForm('estimatedDuration', event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400" />
              {formErrors.estimatedDuration && <p className="mt-1 text-xs text-danger-500">{formErrors.estimatedDuration}</p>}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink-700">Operating days *</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {scheduleDays.map((day) => {
                const checked = formValues.days.includes(day)
                return (
                  <label key={day} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-brand-300 bg-brand-50 text-brand-600' : 'border-ink-100 bg-ink-50 text-ink-500'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleDay(day)} className="sr-only" />
                    {checked && <Check size={14} />} {dayLabels[day]}
                  </label>
                )
              })}
            </div>
            {formErrors.days && <p className="mt-1 text-xs text-danger-500">{formErrors.days}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="schedule-from" className="block text-sm font-semibold text-ink-700">Effective from *</label>
              <input id="schedule-from" type="date" value={formValues.effectiveFrom} onChange={(event) => updateForm('effectiveFrom', event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400" />
              {formErrors.effectiveFrom && <p className="mt-1 text-xs text-danger-500">{formErrors.effectiveFrom}</p>}
            </div>
            <div>
              <label htmlFor="schedule-until" className="block text-sm font-semibold text-ink-700">Effective until</label>
              <div className="relative">
                <input id="schedule-until" type="date" min={formValues.effectiveFrom} value={formValues.effectiveUntil} onChange={(event) => updateForm('effectiveUntil', event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400" />
                {formValues.effectiveUntil && <button type="button" onClick={() => updateForm('effectiveUntil', '')} aria-label="Clear effective until date" className="absolute right-2 top-3 rounded p-1 text-ink-500 hover:bg-ink-100"><X size={15} /></button>}
              </div>
              {formErrors.effectiveUntil && <p className="mt-1 text-xs text-danger-500">{formErrors.effectiveUntil}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="schedule-description" className="block text-sm font-semibold text-ink-700">Description <span className="font-normal text-ink-500">(optional)</span></label>
            <textarea id="schedule-description" rows={3} maxLength={1000} value={formValues.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Service notes or passenger-facing description" className="mt-1.5 w-full rounded-lg border border-ink-100 bg-ink-50 p-3 text-sm text-ink-900 outline-none focus:border-brand-400" />
            {formErrors.description && <p className="mt-1 text-xs text-danger-500">{formErrors.description}</p>}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteTarget(null)
        }}
        title="Delete schedule?"
        description={deleteTarget?.route.name}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button type="button" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} className="bg-danger-500 hover:bg-danger-600">
              {deleteMutation.isPending && <LoaderCircle size={16} className="animate-spin" />} Delete schedule
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-ink-600">
          This permanently removes the schedule. Schedules with generated trips cannot be deleted; deactivate those instead.
        </p>
        {deleteMutation.isError && <Notice className="mt-4">{apiMessage(deleteMutation.error)}</Notice>}
      </Modal>
    </div>
  )
}
