import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  MapPin,
  Plus,
  Route as RouteIcon,
  Search,
  Trash2,
} from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/shared/PageState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Notice } from '@/components/ui/Notice'
import { apiMessage } from '@/services/api'
import { routesService } from '@/services/routes'
import type { RoutePayload, RouteStop, Stop, TransportRoute } from '@/types/routes'

type RouteFormValues = {
  name: string
  routeCode: string
  originStopId: string
  destinationStopId: string
  description: string
  distanceKm: string
  estimatedDuration: string
}

type FormErrors = Partial<Record<keyof RouteFormValues, string>>
type SaveVariables = { routeId: number | null; payload: RoutePayload }

const inputClass = 'mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400'

function initialForm(route?: TransportRoute | null): RouteFormValues {
  return {
    name: route?.name ?? '',
    routeCode: route?.routeCode ?? '',
    originStopId: route?.originStopId == null ? '' : String(route.originStopId),
    destinationStopId: route?.destinationStopId == null ? '' : String(route.destinationStopId),
    description: route?.description ?? '',
    distanceKm: route?.distanceKm == null ? '' : String(route.distanceKm),
    estimatedDuration: route?.estimatedDuration == null ? '' : String(route.estimatedDuration),
  }
}

function validateForm(values: RouteFormValues): FormErrors {
  const errors: FormErrors = {}
  const distance = values.distanceKm === '' ? null : Number(values.distanceKm)
  const duration = values.estimatedDuration === '' ? null : Number(values.estimatedDuration)
  if (values.name.trim().length < 2 || values.name.trim().length > 150) errors.name = 'Enter a route name from 2 to 150 characters.'
  if (values.routeCode.trim().length > 50) errors.routeCode = 'Route code cannot exceed 50 characters.'
  if (!values.originStopId) errors.originStopId = 'Select a starting terminal.'
  if (!values.destinationStopId) errors.destinationStopId = 'Select a destination terminal.'
  if (values.originStopId && values.originStopId === values.destinationStopId) errors.destinationStopId = 'Choose a different destination terminal.'
  if (values.description.length > 5000) errors.description = 'Description cannot exceed 5000 characters.'
  if (distance !== null && (!Number.isFinite(distance) || distance < 0 || distance > 99999999)) errors.distanceKm = 'Enter a distance from 0 to 99,999,999 km.'
  if (duration !== null && (!Number.isInteger(duration) || duration < 1)) errors.estimatedDuration = 'Enter a whole number greater than 0.'
  return errors
}

function routeDescription(route: Pick<TransportRoute, 'origin' | 'destination' | 'originStop' | 'destinationStop'>) {
  return `${route.originStop?.name ?? route.origin} to ${route.destinationStop?.name ?? route.destination}`
}

function terminalCoordinates(stop?: Stop | null) {
  if (!stop) return 'Coordinates unavailable'
  const latitude = Number(stop.latitude)
  const longitude = Number(stop.longitude)
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    : 'Coordinates unavailable'
}

function RouteFormField({
  id,
  label,
  value,
  error,
  onChange,
  type = 'text',
  ...inputProps
}: {
  id: string
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
  type?: InputHTMLAttributes<HTMLInputElement>['type']
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange' | 'type'>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink-700">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        {...inputProps}
      />
      {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
    </div>
  )
}

export function RoutesPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null)
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null)
  const [formValues, setFormValues] = useState<RouteFormValues>(() => initialForm())
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<TransportRoute | null>(null)
  const [selectedStopId, setSelectedStopId] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState('')
  const [stopError, setStopError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const routesQuery = useQuery({
    queryKey: ['routes', 'list', { page, search }],
    queryFn: () => routesService.list({ page, limit: 10, search }),
  })

  const stopsQuery = useQuery({
    queryKey: ['routes', 'stops'],
    queryFn: async () => {
      const firstPage = await routesService.listStops(1)
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.pagination.totalPages - 1) }, (_, index) =>
          routesService.listStops(index + 2),
        ),
      )
      return [...firstPage.stops, ...remainingPages.flatMap((result) => result.stops)]
    },
  })

  const routeQuery = useQuery({
    queryKey: ['routes', 'detail', selectedRouteId],
    queryFn: () => {
      if (selectedRouteId === null) throw new Error('Select a route before loading its details.')
      return routesService.get(selectedRouteId)
    },
    enabled: selectedRouteId !== null,
  })

  const refreshRoutes = () => {
    void queryClient.invalidateQueries({ queryKey: ['routes'] })
  }

  const saveMutation = useMutation({
    mutationFn: ({ routeId, payload }: SaveVariables) => routeId === null
      ? routesService.create(payload)
      : routesService.update(routeId, payload),
    onSuccess: async (route, variables) => {
      setFeedback({ tone: 'success', message: variables.routeId === null ? 'Route created.' : 'Route updated.' })
      setFormOpen(false)
      setEditingRoute(null)
      setPage(1)
      if (variables.routeId === null) {
        setSearch('')
        setSearchInput('')
      }
      setSelectedRouteId(route.id)
      await queryClient.invalidateQueries({ queryKey: ['routes'] })
    },
    onError: (error) => setFeedback({ tone: 'error', message: apiMessage(error) }),
  })

  const deleteMutation = useMutation({
    mutationFn: routesService.delete,
    onSuccess: async (_data, routeId) => {
      setFeedback({ tone: 'success', message: 'Route deleted.' })
      setDeleteTarget(null)
      if (selectedRouteId === routeId) setSelectedRouteId(null)
      await queryClient.invalidateQueries({ queryKey: ['routes'] })
    },
    onError: (error) => {
      setDeleteTarget(null)
      setFeedback({ tone: 'error', message: apiMessage(error) })
    },
  })

  const attachMutation = useMutation({
    mutationFn: ({ routeId, stopId, sequence, estimatedMinutesFromStart }: {
      routeId: number
      stopId: number
      sequence: number
      estimatedMinutesFromStart: number | null
    }) => routesService.attachStop(routeId, { stopId, sequence, estimatedMinutesFromStart }),
    onSuccess: async (_routeStop, variables) => {
      setFeedback({ tone: 'success', message: 'Stop added to route.' })
      setSelectedStopId('')
      setEstimatedMinutes('')
      setStopError(null)
      await queryClient.invalidateQueries({ queryKey: ['routes', 'detail', variables.routeId] })
    },
    onError: (error) => setStopError(apiMessage(error)),
  })

  const detachMutation = useMutation({
    mutationFn: ({ routeId, stopId }: { routeId: number; stopId: number }) =>
      routesService.detachStop(routeId, stopId),
    onSuccess: async (_data, variables) => {
      setFeedback({ tone: 'success', message: 'Stop removed from route.' })
      await queryClient.invalidateQueries({ queryKey: ['routes', 'detail', variables.routeId] })
    },
    onError: (error) => setStopError(apiMessage(error)),
  })

  const reorderMutation = useMutation({
    mutationFn: ({ routeId, stops }: { routeId: number; stops: Array<{ stopId: number; sequence: number }> }) =>
      routesService.reorderStops(routeId, stops),
    onSuccess: async (_data, variables) => {
      setFeedback({ tone: 'success', message: 'Stop order updated.' })
      await queryClient.invalidateQueries({ queryKey: ['routes', 'detail', variables.routeId] })
    },
    onError: (error) => setStopError(apiMessage(error)),
  })

  const routes = routesQuery.data?.routes ?? []
  const pagination = routesQuery.data?.pagination
  const route = routeQuery.data
  const routeStops = route?.routeStops ?? []
  const attachedStopIds = new Set(routeStops.map((item) => item.stopId))
  const terminals = stopsQuery.data ?? []
  const endpointStopIds = new Set([route?.originStopId, route?.destinationStopId])
  const availableStops = terminals.filter((stop) => !attachedStopIds.has(stop.id) && !endpointStopIds.has(stop.id))
  const originTerminal = terminals.find((stop) => String(stop.id) === formValues.originStopId)
  const destinationTerminal = terminals.find((stop) => String(stop.id) === formValues.destinationStopId)
  const mutationPending = saveMutation.isPending || deleteMutation.isPending
  const stopMutationPending = attachMutation.isPending || detachMutation.isPending || reorderMutation.isPending

  function openCreateForm() {
    setEditingRoute(null)
    setFormValues(initialForm())
    setFormErrors({})
    setFormOpen(true)
    setFeedback(null)
  }

  function openEditForm(selectedRoute: TransportRoute) {
    setEditingRoute(selectedRoute)
    setFormValues(initialForm(selectedRoute))
    setFormErrors({})
    setFormOpen(true)
    setFeedback(null)
  }

  function updateForm<K extends keyof RouteFormValues>(key: K, value: RouteFormValues[K]) {
    setFormValues((current) => ({ ...current, [key]: value }))
    setFormErrors((current) => ({ ...current, [key]: undefined }))
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateForm(formValues)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    const payload: RoutePayload = {
      name: formValues.name.trim(),
      routeCode: formValues.routeCode.trim() || null,
      originStopId: Number(formValues.originStopId),
      destinationStopId: Number(formValues.destinationStopId),
      description: formValues.description.trim() || null,
      distanceKm: formValues.distanceKm === '' ? null : Number(formValues.distanceKm),
      estimatedDuration: formValues.estimatedDuration === '' ? null : Number(formValues.estimatedDuration),
    }
    saveMutation.mutate({ routeId: editingRoute?.id ?? null, payload })
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
    setSelectedRouteId(null)
    setFeedback(null)
  }

  function submitAttachStop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!route || !selectedStopId) {
      setStopError('Select a stop to add.')
      return
    }
    const minutes = estimatedMinutes === '' ? null : Number(estimatedMinutes)
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0)) {
      setStopError('Estimated minutes must be a whole number of 0 or more.')
      return
    }
    const sequence = routeStops.reduce((maximum, item) => Math.max(maximum, item.sequence), 0) + 1
    setStopError(null)
    attachMutation.mutate({
      routeId: route.id,
      stopId: Number(selectedStopId),
      sequence,
      estimatedMinutesFromStart: minutes,
    })
  }

  function moveStop(item: RouteStop, direction: -1 | 1) {
    if (!route || stopMutationPending) return
    const currentIndex = routeStops.findIndex((routeStop) => routeStop.id === item.id)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= routeStops.length) return
    const reordered = [...routeStops]
    ;[reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]]
    setStopError(null)
    reorderMutation.mutate({
      routeId: route.id,
      stops: reordered.map((routeStop, index) => ({ stopId: routeStop.stopId, sequence: index + 1 })),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routes"
        description="Create active routes, update route details, and manage their ordered stops."
        status={pagination && <Badge tone="info">{pagination.total} active routes</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton size="sm" onRefresh={refreshRoutes} refreshing={routesQuery.isFetching} />
            <Button onClick={openCreateForm}><Plus size={17} /> New route</Button>
          </div>
        }
      />

      <div role="note" className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">
        This page lists active routes from the existing public routes endpoint. Inactive routes are not returned by the backend and cannot be managed here.
      </div>
      {feedback && <Notice tone={feedback.tone === 'success' ? 'success' : 'error'}>{feedback.message}</Notice>}

      <Card className="p-4 sm:p-5">
        <form onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block min-w-0">
            <span className="sr-only">Search active routes</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search route name, origin, or destination"
              className="h-11 w-full rounded-lg border border-ink-100 bg-ink-50 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-400"
            />
          </label>
          <Button type="submit" variant="secondary"><Search size={16} /> Search</Button>
        </form>
      </Card>

      {routesQuery.isLoading && (
        <Card className="grid min-h-56 place-items-center text-ink-500">
          <span className="flex items-center gap-2"><LoaderCircle size={20} className="animate-spin" /> Loading routes…</span>
        </Card>
      )}
      {routesQuery.isError && (
        <ErrorState
          title="Could not load routes"
          message={apiMessage(routesQuery.error)}
          action={<Button variant="secondary" onClick={() => void routesQuery.refetch()}>Try again</Button>}
        />
      )}
      {routesQuery.data && routes.length === 0 && (
        <EmptyState
          title={search ? 'No matching active routes' : 'No active routes yet'}
          message={search ? 'Try another route name, origin, or destination.' : 'Create a route to begin managing scheduled transport services.'}
          action={!search ? <Button onClick={openCreateForm}><Plus size={16} /> Create route</Button> : undefined}
        />
      )}

      {routesQuery.data && pagination && routes.length > 0 && (
        <>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <div className="space-y-3">
              {routes.map((item) => (
                <Card key={item.id} className={`p-4 transition ${selectedRouteId === item.id ? 'border-brand-300 ring-1 ring-brand-300' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setSelectedRouteId(item.id); setStopError(null); if (window.matchMedia('(max-width: 1279px)').matches) setMobileDetailsOpen(true) }}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-ink-900">{item.name}</span>
                        <Badge tone="success">ACTIVE</Badge>
                        {item.routeCode && <Badge>{item.routeCode}</Badge>}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                        <RouteIcon size={15} /> {routeDescription(item)}
                      </span>
                      <span className="mt-2 grid gap-1 text-xs text-ink-500 sm:grid-cols-2">
                        <span>Start: {item.originStop?.name ?? item.origin} · {terminalCoordinates(item.originStop)}</span>
                        <span>Destination: {item.destinationStop?.name ?? item.destination} · {terminalCoordinates(item.destinationStop)}</span>
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEditForm(item)} disabled={mutationPending}>Edit</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger-500 hover:text-danger-600"
                        onClick={() => setDeleteTarget(item)}
                        disabled={mutationPending}
                      >
                        <Trash2 size={15} /> Delete
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-100 pt-3 text-xs text-ink-500">
                    {item.distanceKm != null && <span>{item.distanceKm} km</span>}
                    {item.estimatedDuration != null && <span>{item.estimatedDuration} min estimated</span>}
                    <span>{item.description || 'No description'}</span>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="hidden p-4 sm:p-5 xl:block">
              {!selectedRouteId && (
                <div className="grid min-h-48 place-items-center text-center">
                  <div>
                    <RouteIcon size={24} className="mx-auto text-ink-400" />
                    <h2 className="mt-3 font-bold text-ink-900">Select a route</h2>
                    <p className="mt-1 text-sm text-ink-500">Choose a route to view and manage its ordered stops.</p>
                  </div>
                </div>
              )}
              {selectedRouteId !== null && routeQuery.isLoading && (
                <div className="grid min-h-48 place-items-center text-ink-500">
                  <span className="flex items-center gap-2"><LoaderCircle size={19} className="animate-spin" /> Loading route stops…</span>
                </div>
              )}
              {selectedRouteId !== null && routeQuery.isError && (
                <ErrorState
                  title="Could not load route details"
                  message={apiMessage(routeQuery.error)}
                  action={<Button variant="secondary" onClick={() => void routeQuery.refetch()}>Try again</Button>}
                />
              )}
              {route && (
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 pb-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-ink-900">{route.name}</h2>
                        <Badge tone="success">ACTIVE</Badge>
                      </div>
                      <p className="mt-1 text-sm text-ink-500">{routeDescription(route)}</p>
                      <p className="mt-2 text-xs text-ink-500">
                        Start: {route.originStop?.name ?? route.origin} · {terminalCoordinates(route.originStop)}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        Destination: {route.destinationStop?.name ?? route.destination} · {terminalCoordinates(route.destinationStop)}
                      </p>
                    </div>
                    <Badge tone="info">{routeStops.length} stops</Badge>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-sm font-bold text-ink-900">Ordered stops</h3>
                    {routeStops.length === 0 ? (
                      <p className="mt-2 rounded-lg bg-ink-950 p-3 text-sm text-ink-500">No stops are attached to this route.</p>
                    ) : (
                      <ol className="mt-3 space-y-2">
                        {routeStops.map((item, index) => (
                          <li key={item.id} className="flex items-start gap-3 rounded-xl border border-ink-100 bg-ink-950 p-3">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{item.sequence}</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-ink-900">{item.stop.name}</p>
                              <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
                                <MapPin size={13} /> {item.stop.latitude}, {item.stop.longitude}
                                {item.estimatedMinutesFromStart !== null && ` · ${item.estimatedMinutesFromStart} min from start`}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 px-0"
                                aria-label={`Move ${item.stop.name} up`}
                                onClick={() => moveStop(item, -1)}
                                disabled={index === 0 || stopMutationPending}
                              >
                                <ArrowUp size={15} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 px-0"
                                aria-label={`Move ${item.stop.name} down`}
                                onClick={() => moveStop(item, 1)}
                                disabled={index === routeStops.length - 1 || stopMutationPending}
                              >
                                <ArrowDown size={15} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 px-0 text-danger-500 hover:text-danger-600"
                                aria-label={`Remove ${item.stop.name} from route`}
                                onClick={() => {
                                  setStopError(null)
                                  detachMutation.mutate({ routeId: route.id, stopId: item.stopId })
                                }}
                                disabled={stopMutationPending}
                              >
                                {detachMutation.isPending && detachMutation.variables?.stopId === item.stopId
                                  ? <LoaderCircle size={15} className="animate-spin" />
                                  : <Trash2 size={15} />}
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <div className="mt-5 border-t border-ink-100 pt-4">
                    <h3 className="text-sm font-bold text-ink-900">Add a stop</h3>
                    {stopsQuery.isError && <p role="alert" className="mt-2 text-sm text-danger-500">Stops could not be loaded: {apiMessage(stopsQuery.error)}</p>}
                    {stopsQuery.data && availableStops.length === 0 && (
                      <p className="mt-2 text-sm text-ink-500">
                        {stopsQuery.data.length === 0 ? 'No stops are registered yet.' : 'Every registered stop is already on this route.'}
                      </p>
                    )}
                    {availableStops.length > 0 && (
                      <form onSubmit={submitAttachStop} className="mt-3 space-y-3">
                        <label className="block text-sm font-semibold text-ink-700">
                          Stop
                          <select
                            value={selectedStopId}
                            onChange={(event) => setSelectedStopId(event.target.value)}
                            className={inputClass}
                          >
                            <option value="">Select a stop</option>
                            {availableStops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}
                          </select>
                        </label>
                        <label className="block text-sm font-semibold text-ink-700">
                          Estimated minutes from start <span className="font-normal text-ink-500">(optional)</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={estimatedMinutes}
                            onChange={(event) => setEstimatedMinutes(event.target.value)}
                            className={inputClass}
                          />
                        </label>
                        {stopError && <Notice>{stopError}</Notice>}
                        <Button type="submit" size="sm" disabled={attachMutation.isPending || !selectedStopId}>
                          {attachMutation.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}
                          Add stop
                        </Button>
                      </form>
                    )}
                    {stopsQuery.isLoading && <p className="mt-2 flex items-center gap-2 text-sm text-ink-500"><LoaderCircle size={15} className="animate-spin" /> Loading available stops…</p>}
                  </div>
                  {stopError && !availableStops.length && <div className="mt-3"><Notice>{stopError}</Notice></div>}
                </div>
              )}
            </Card>
          </div>

          <Modal
            isOpen={mobileDetailsOpen}
            onClose={() => setMobileDetailsOpen(false)}
            title={route?.name ?? 'Route details'}
            description={route ? routeDescription(route) : 'Route information and ordered stops.'}
            size="xl"
          >
            {routeQuery.isLoading && (
              <div className="grid min-h-40 place-items-center text-ink-500">
                <span className="flex items-center gap-2"><LoaderCircle size={19} className="animate-spin" /> Loading route details…</span>
              </div>
            )}
            {routeQuery.isError && (
              <ErrorState
                title="Could not load route details"
                message={apiMessage(routeQuery.error)}
                action={<Button variant="secondary" onClick={() => void routeQuery.refetch()}>Try again</Button>}
              />
            )}
            {route && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">ACTIVE</Badge>
                  {route.routeCode && <Badge>{route.routeCode}</Badge>}
                  <Badge tone="info">{routeStops.length} stops</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-ink-100 bg-ink-950 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Start</p>
                    <p className="mt-1 font-semibold text-ink-900">{route.originStop?.name ?? route.origin}</p>
                    <p className="mt-1 text-xs text-ink-500">{terminalCoordinates(route.originStop)}</p>
                  </div>
                  <div className="rounded-xl border border-ink-100 bg-ink-950 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Destination</p>
                    <p className="mt-1 font-semibold text-ink-900">{route.destinationStop?.name ?? route.destination}</p>
                    <p className="mt-1 text-xs text-ink-500">{terminalCoordinates(route.destinationStop)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-ink-600">
                  {route.distanceKm != null && <span>{route.distanceKm} km</span>}
                  {route.estimatedDuration != null && <span>{route.estimatedDuration} min estimated</span>}
                </div>
                {route.description && <p className="whitespace-pre-wrap text-sm leading-6 text-ink-600">{route.description}</p>}
                <div>
                  <h3 className="text-sm font-bold text-ink-900">Ordered stops</h3>
                  {routeStops.length === 0 ? (
                    <p className="mt-2 rounded-lg bg-ink-950 p-3 text-sm text-ink-500">No stops are attached to this route.</p>
                  ) : (
                    <ol className="mt-3 space-y-2">
                      {routeStops.map((item) => (
                        <li key={item.id} className="flex items-start gap-3 rounded-xl border border-ink-100 bg-ink-950 p-3">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{item.sequence}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-ink-900">{item.stop.name}</p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
                              <MapPin size={13} /> {item.stop.latitude}, {item.stop.longitude}
                              {item.estimatedMinutesFromStart !== null && ` · ${item.estimatedMinutesFromStart} min from start`}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </Modal>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} active routes
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setPage((current) => Math.max(1, current - 1)); setSelectedRouteId(null) }} disabled={page <= 1 || routesQuery.isFetching}>
                <ChevronLeft size={16} /> Previous
              </Button>
              <span className="px-2 text-sm text-ink-500">Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span>
              <Button variant="secondary" size="sm" onClick={() => { setPage((current) => current + 1); setSelectedRouteId(null) }} disabled={routesQuery.isFetching || page >= pagination.totalPages}>
                Next <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={formOpen}
        onClose={() => { if (!saveMutation.isPending) { setFormOpen(false); setEditingRoute(null) } }}
        title={editingRoute ? 'Edit route' : 'Create route'}
        description="New routes are created as active. This page only lists active routes."
        size="xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => { setFormOpen(false); setEditingRoute(null) }} disabled={saveMutation.isPending}>Cancel</Button>
            <Button type="submit" form="route-form" disabled={saveMutation.isPending || stopsQuery.isLoading || stopsQuery.isError || terminals.length < 2}>
              {saveMutation.isPending && <LoaderCircle size={16} className="animate-spin" />}
              {editingRoute ? 'Save changes' : 'Create route'}
            </Button>
          </>
        }
      >
        <form id="route-form" onSubmit={submitForm} className="space-y-4" noValidate>
          {saveMutation.isError && <Notice>{apiMessage(saveMutation.error)}</Notice>}
          {stopsQuery.isError && <Notice>Terminals could not be loaded: {apiMessage(stopsQuery.error)}</Notice>}
          {!stopsQuery.isError && stopsQuery.data && terminals.length < 2 && (
            <p role="note" className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">
              Create at least two terminals before creating a route.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <RouteFormField id="route-name" label="Route name *" value={formValues.name} error={formErrors.name} onChange={(value) => updateForm('name', value)} maxLength={150} />
            <RouteFormField id="route-code" label="Route code" value={formValues.routeCode} error={formErrors.routeCode} onChange={(value) => updateForm('routeCode', value)} maxLength={50} />
            <div>
              <label htmlFor="route-origin-stop" className="block text-sm font-semibold text-ink-700">Starting terminal *</label>
              <select id="route-origin-stop" value={formValues.originStopId} onChange={(event) => updateForm('originStopId', event.target.value)} className={inputClass} disabled={stopsQuery.isLoading || stopsQuery.isError || terminals.length === 0}>
                <option value="">Select a terminal</option>
                {terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}
              </select>
              {originTerminal && <p className="mt-1 text-xs text-ink-500">Coordinates: {terminalCoordinates(originTerminal)}</p>}
              {formErrors.originStopId && <p className="mt-1 text-xs text-danger-500">{formErrors.originStopId}</p>}
            </div>
            <div>
              <label htmlFor="route-destination-stop" className="block text-sm font-semibold text-ink-700">Destination terminal *</label>
              <select id="route-destination-stop" value={formValues.destinationStopId} onChange={(event) => updateForm('destinationStopId', event.target.value)} className={inputClass} disabled={stopsQuery.isLoading || stopsQuery.isError || terminals.length === 0}>
                <option value="">Select a terminal</option>
                {terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}
              </select>
              {destinationTerminal && <p className="mt-1 text-xs text-ink-500">Coordinates: {terminalCoordinates(destinationTerminal)}</p>}
              {formErrors.destinationStopId && <p className="mt-1 text-xs text-danger-500">{formErrors.destinationStopId}</p>}
            </div>
            <RouteFormField id="route-distance" label="Distance (km)" type="number" value={formValues.distanceKm} error={formErrors.distanceKm} onChange={(value) => updateForm('distanceKm', value)} min={0} max={99999999} step="any" />
            <RouteFormField id="route-duration" label="Estimated duration (minutes)" type="number" value={formValues.estimatedDuration} error={formErrors.estimatedDuration} onChange={(value) => updateForm('estimatedDuration', value)} min={1} step={1} />
          </div>
          <div>
            <label htmlFor="route-description" className="block text-sm font-semibold text-ink-700">Description</label>
            <textarea
              id="route-description"
              value={formValues.description}
              onChange={(event) => updateForm('description', event.target.value)}
              maxLength={5000}
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-400"
            />
            {formErrors.description && <p className="mt-1 text-xs text-danger-500">{formErrors.description}</p>}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => { if (!deleteMutation.isPending) setDeleteTarget(null) }}
        title="Delete route?"
        description={deleteTarget ? `${deleteTarget.name} (${routeDescription(deleteTarget)}) will be removed if the backend allows it.` : undefined}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button
              type="button"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
              disabled={deleteMutation.isPending || deleteTarget === null}
            >
              {deleteMutation.isPending && <LoaderCircle size={16} className="animate-spin" />}
              Delete route
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Routes with existing trips cannot be deleted. The backend will reject deletion when trip history exists.
        </p>
      </Modal>
    </div>
  )
}
