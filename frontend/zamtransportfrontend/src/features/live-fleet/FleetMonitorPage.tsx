import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import {
  Activity,
  BusFront,
  Crosshair,
  MapPin,
  RefreshCw,
  Search,
  Signal,
  SignalZero,
  Wifi,
  WifiOff,
} from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ErrorState } from '@/components/shared/PageState'
import { apiMessage } from '@/services/api'
import { connectSocket } from '@/services/socket'
import { getAccessToken } from '@/stores/auth-store'
import { vehiclesService } from '@/services/vehicles'
import type { VehicleListItem, VehicleStatus } from '@/types/vehicles'
import { trackingService } from './liveVehicles.api'
import type { LiveVehicleLocation, VehicleEta, VehicleLocationUpdate } from './liveLocation.types'

const GPS_FRESHNESS_MS = 60_000
const vehicleStatuses: VehicleStatus[] = ['ACTIVE', 'INACTIVE', 'MAINTENANCE']
type SocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

type MonitoringVehicle = {
  id: number
  registrationNumber: string
  vehicleName: string | null
  manufacturer: string | null
  model: string | null
  vehicleType: string | null
  status: VehicleStatus | null
  activeAssignment: VehicleListItem['assignments'][number] | null
  location: LiveVehicleLocation | null
}

function isValidLocation(location: LiveVehicleLocation) {
  return Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && location.longitude >= -180
    && location.longitude <= 180
}

function isLocationUpdate(value: unknown): value is VehicleLocationUpdate {
  if (!value || typeof value !== 'object') return false
  const update = value as Partial<VehicleLocationUpdate>
  return Number.isInteger(update.vehicleId)
    && Number.isInteger(update.tripId)
    && Number.isInteger(update.routeId)
    && typeof update.latitude === 'number'
    && typeof update.longitude === 'number'
    && update.latitude >= -90
    && update.latitude <= 90
    && update.longitude >= -180
    && update.longitude <= 180
    && (update.speed === null || (typeof update.speed === 'number' && Number.isFinite(update.speed)))
    && (update.heading === null || (typeof update.heading === 'number' && Number.isFinite(update.heading)))
    && typeof update.isSimulated === 'boolean'
    && typeof update.recordedAt === 'string'
    && Number.isFinite(Date.parse(update.recordedAt))
}

async function getFleetVehicles() {
  const firstPage = await vehiclesService.list({ page: 1, limit: 100 })
  const pages = Array.from({ length: Math.max(0, firstPage.data.pagination.totalPages - 1) }, (_, index) => index + 2)
  const remainingPages = await Promise.all(pages.map((page) => vehiclesService.list({ page, limit: 100 })))
  return {
    vehicles: [
      ...firstPage.data.vehicles,
      ...remainingPages.flatMap((page) => page.data.vehicles),
    ],
    total: firstPage.data.pagination.total,
  }
}

function locationFreshness(location: LiveVehicleLocation | null, now: number) {
  if (!location) return 'unavailable'
  const age = now - Date.parse(location.recordedAt)
  return Number.isFinite(age) && age >= 0 && age <= GPS_FRESHNESS_MS ? 'fresh' : 'stale'
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatSpeed(speed: number | null | undefined) {
  return speed === null || speed === undefined ? 'Not available' : `${speed.toFixed(1)} km/h`
}

function gpsTone(vehicle: MonitoringVehicle, now: number): 'success' | 'warning' | 'neutral' {
  const freshness = locationFreshness(vehicle.location, now)
  if (freshness === 'unavailable') return 'neutral'
  if (freshness === 'stale') return 'warning'
  return 'success'
}

function MapView({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (fitted.current || positions.length === 0) return
    fitted.current = true
    if (positions.length === 1) {
      map.setView(positions[0], 13)
      return
    }
    map.fitBounds(positions, { padding: [40, 40], maxZoom: 13 })
  }, [map, positions])

  return null
}

function SummaryCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string
  value: number | string
  note: string
  icon: typeof BusFront
  tone: 'brand' | 'success' | 'warning' | 'danger'
}) {
  const toneClass = {
    brand: 'bg-brand-50 text-brand-500',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-500',
    danger: 'bg-danger-50 text-danger-500',
  }[tone]

  return (
    <Card className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-500">{label}</p>
        <p className="mt-1 text-2xl font-extrabold text-ink-900">{value}</p>
        <p className="mt-1 text-xs text-ink-500">{note}</p>
      </div>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneClass}`}>
        <Icon size={19} />
      </span>
    </Card>
  )
}

function SocketIndicator({ status }: { status: SocketStatus }) {
  const labels: Record<SocketStatus, string> = {
    connecting: 'Connecting',
    connected: 'Connected',
    reconnecting: 'Reconnecting',
    disconnected: 'Disconnected',
  }
  const Icon = status === 'connected' ? Wifi : status === 'disconnected' ? WifiOff : RefreshCw
  const color = status === 'connected' ? 'text-success-500' : status === 'disconnected' ? 'text-danger-500' : 'text-warning-500'

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-ink-50 px-3 py-2 text-sm font-semibold text-ink-700">
      <Icon size={16} className={`${color} ${status === 'connecting' || status === 'reconnecting' ? 'animate-spin' : ''}`} />
      Live feed: {labels[status]}
    </span>
  )
}

function VehicleList({
  vehicles,
  now,
  selectedId,
  search,
  statusFilter,
  onSearchChange,
  onStatusChange,
  onSelect,
}: {
  vehicles: MonitoringVehicle[]
  now: number
  selectedId: number | null
  search: string
  statusFilter: VehicleStatus | 'ALL'
  onSearchChange: (value: string) => void
  onStatusChange: (value: VehicleStatus | 'ALL') => void
  onSelect: (vehicle: MonitoringVehicle) => void
}) {
  const visibleVehicles = vehicles.filter((vehicle) => {
    const matchesSearch = vehicle.registrationNumber.toLowerCase().includes(search.trim().toLowerCase())
    return matchesSearch && (statusFilter === 'ALL' || vehicle.status === statusFilter)
  })

  return (
    <Card className="flex max-h-[720px] min-h-72 flex-col overflow-hidden">
      <div className="border-b border-ink-100 p-4">
        <h2 className="font-bold text-ink-900">Fleet vehicles</h2>
        <p className="mt-1 text-xs text-ink-500">{vehicles.length} vehicles in the register</p>
        <label className="relative mt-3 block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search registration"
            aria-label="Search vehicles by registration"
            className="w-full rounded-lg border border-ink-100 bg-ink-50 py-2 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-400"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value as VehicleStatus | 'ALL')}
          aria-label="Filter by vehicle status"
          className="mt-2 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-400"
        >
          <option value="ALL">All vehicle statuses</option>
          {vehicleStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {visibleVehicles.map((vehicle) => {
          const freshness = locationFreshness(vehicle.location, now)
          return (
            <button
              key={vehicle.id}
              type="button"
              onClick={() => onSelect(vehicle)}
              aria-pressed={selectedId === vehicle.id}
              className={`w-full rounded-xl border p-3 text-left transition ${selectedId === vehicle.id ? 'border-brand-300 bg-brand-50' : 'border-ink-100 bg-ink-50 hover:border-ink-200'}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-bold text-ink-900">{vehicle.registrationNumber}</span>
                <Badge tone={gpsTone(vehicle, now)}>{freshness === 'fresh' ? 'Fresh GPS' : freshness === 'stale' ? 'Stale GPS' : 'No GPS'}</Badge>
              </span>
              <span className="mt-1 block truncate text-xs text-ink-500">
                {[vehicle.manufacturer, vehicle.model, vehicle.vehicleType].filter(Boolean).join(' · ') || 'Vehicle details unavailable'}
              </span>
              <span className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-500">
                <span>{vehicle.status ?? 'Status unavailable'}</span>
                <span>{formatSpeed(vehicle.location?.speed)}</span>
              </span>
            </button>
          )
        })}
        {visibleVehicles.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-ink-500">No vehicles match these filters.</p>
        )}
      </div>
    </Card>
  )
}

function VehicleDetails({
  vehicle,
  eta,
  etaLoading,
  now,
}: {
  vehicle: MonitoringVehicle | null
  eta?: VehicleEta
  etaLoading: boolean
  now: number
}) {
  if (!vehicle) {
    return <Card className="grid min-h-64 place-items-center p-6 text-center text-sm text-ink-500">Select a vehicle to view its details.</Card>
  }

  const location = vehicle.location
  const driver = vehicle.activeAssignment?.driver
  const fields: Array<[string, string]> = [
    ['Vehicle status', vehicle.status ?? 'Not available'],
    ['Vehicle', [vehicle.manufacturer, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicleName || 'Not available'],
    ['Vehicle type', vehicle.vehicleType ?? 'Not available'],
    ['Assigned driver', driver?.fullName ?? 'Not available'],
    ['Driver contact', driver?.email ?? 'Not available'],
    ['Trip', location?.trip?.tripCode ?? (location?.tripId ? `Trip ${location.tripId}` : 'Not available')],
    ['Trip status', location?.trip?.status ?? 'Not available'],
    ['Origin', location?.route?.origin ?? 'Not available'],
    ['Destination', location?.route?.destination ?? 'Not available'],
    ['Scheduled arrival', formatDateTime(location?.trip?.scheduledArrival)],
    ['Latitude', location ? location.latitude.toFixed(6) : 'Not available'],
    ['Longitude', location ? location.longitude.toFixed(6) : 'Not available'],
    ['Speed', formatSpeed(location?.speed)],
    ['Heading', location?.heading == null ? 'Not available' : `${location.heading.toFixed(0)}°`],
    ['Last GPS update', formatDateTime(location?.recordedAt)],
  ]

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-100 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-bold text-ink-900">{vehicle.registrationNumber}</h2>
            <p className="mt-1 text-xs text-ink-500">{vehicle.vehicleName ?? 'Vehicle monitoring details'}</p>
          </div>
          <Badge tone={gpsTone(vehicle, now)}>
            {locationFreshness(location, now) === 'fresh' ? 'Fresh GPS' : locationFreshness(location, now) === 'stale' ? 'Stale GPS' : 'No GPS'}
          </Badge>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-500"><BusFront size={15} /> Vehicle, driver & trip</h3>
          <dl className="space-y-2">
            {fields.slice(0, 10).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 text-xs">
                <dt className="text-ink-500">{label}</dt>
                <dd className="max-w-[60%] text-right font-semibold text-ink-800">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-500"><Crosshair size={15} /> Live GPS</h3>
          <dl className="space-y-2">
            {fields.slice(10).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 text-xs">
                <dt className="text-ink-500">{label}</dt>
                <dd className="max-w-[60%] text-right font-semibold text-ink-800">{value}</dd>
              </div>
            ))}
          </dl>
          {location && <p className="mt-3 text-xs text-ink-500">{location.isSimulated ? 'Location is simulated by the tracking service.' : 'Location is reported by the vehicle.'}</p>}
        </div>
        {location && (
          <div className="rounded-xl bg-ink-950 p-3 text-xs text-ink-600">
            <p className="font-bold text-ink-800">Trip ETA</p>
            {etaLoading ? <p className="mt-1">Loading estimate…</p> : eta?.available ? (
              <p className="mt-1">
                {eta.remainingDistanceKm != null ? `${eta.remainingDistanceKm} km remaining` : 'Distance not available'}
                {eta.estimatedArrival ? ` · estimated ${formatDateTime(eta.estimatedArrival)}` : ''}
              </p>
            ) : <p className="mt-1">Not available</p>}
          </div>
        )}
      </div>
    </Card>
  )
}

export function FleetMonitorPage() {
  const queryClient = useQueryClient()
  const mapRef = useRef<LeafletMap | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'ALL'>('ALL')
  const [socketStatus, setSocketStatus] = useState<SocketStatus>(() => getAccessToken() ? 'connecting' : 'disconnected')
  const [socketLocations, setSocketLocations] = useState<Record<number, VehicleLocationUpdate>>({})
  const [now, setNow] = useState(() => Date.now())

  const liveQuery = useQuery({
    queryKey: ['tracking', 'live-vehicles'],
    queryFn: trackingService.listLiveVehicles,
  })
  const fleetQuery = useQuery({
    queryKey: ['tracking', 'fleet-vehicles'],
    queryFn: getFleetVehicles,
  })

  const liveLocations = useMemo(() => {
    const locations = new Map<number, LiveVehicleLocation>()
    for (const location of liveQuery.data ?? []) {
      if (isValidLocation(location)) locations.set(location.vehicleId, location)
    }
    for (const update of Object.values(socketLocations)) {
      const current = locations.get(update.vehicleId)
      if (current && Date.parse(current.recordedAt) >= Date.parse(update.recordedAt)) continue
      const sameTrip = current?.tripId === update.tripId
      locations.set(update.vehicleId, {
        ...update,
        ...(sameTrip ? { vehicle: current?.vehicle, trip: current?.trip, route: current?.route } : {}),
      })
    }
    return locations
  }, [liveQuery.data, socketLocations])

  const vehicles = useMemo(() => {
    const listedVehicles = fleetQuery.data?.vehicles ?? []
    const allVehicles: MonitoringVehicle[] = listedVehicles.map((vehicle) => ({
      id: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      vehicleName: vehicle.vehicleName,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      vehicleType: vehicle.vehicleType,
      status: vehicle.status,
      activeAssignment: vehicle.assignments.find((assignment) => assignment.endedAt === null) ?? null,
      location: liveLocations.get(vehicle.id) ?? null,
    }))
    const listedIds = new Set(allVehicles.map((vehicle) => vehicle.id))
    for (const location of liveLocations.values()) {
      if (listedIds.has(location.vehicleId)) continue
      allVehicles.push({
        id: location.vehicleId,
        registrationNumber: location.vehicle?.registrationNumber ?? `Vehicle ${location.vehicleId}`,
        vehicleName: location.vehicle?.vehicleName ?? null,
        manufacturer: null,
        model: null,
        vehicleType: location.vehicle?.vehicleType ?? null,
        status: null,
        activeAssignment: null,
        location,
      })
    }
    return allVehicles
  }, [fleetQuery.data, liveLocations])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const socket = connectSocket()
    if (!socket) return

    const onConnect = () => {
      setSocketStatus('connected')
      void queryClient.invalidateQueries({ queryKey: ['tracking', 'live-vehicles'] })
    }
    const onDisconnect = () => setSocketStatus(socket.active ? 'reconnecting' : 'disconnected')
    const onConnectError = () => setSocketStatus(socket.active ? 'reconnecting' : 'disconnected')
    const onReconnectAttempt = () => setSocketStatus('reconnecting')
    const onLocationUpdate = (payload: unknown) => {
      if (!isLocationUpdate(payload) || !isValidLocation(payload)) return
      setSocketLocations((current) => {
        const previous = current[payload.vehicleId]
        if (previous && Date.parse(previous.recordedAt) >= Date.parse(payload.recordedAt)) return current
        return { ...current, [payload.vehicleId]: payload }
      })
    }

    let connectedTimer: number | undefined
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('vehicle:location:update', onLocationUpdate)
    socket.io.on('reconnect_attempt', onReconnectAttempt)
    if (socket.connected) connectedTimer = window.setTimeout(onConnect, 0)

    return () => {
      if (connectedTimer !== undefined) window.clearTimeout(connectedTimer)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('vehicle:location:update', onLocationUpdate)
      socket.io.off('reconnect_attempt', onReconnectAttempt)
    }
  }, [queryClient])

  const resolvedSelectedId = selectedId !== null && vehicles.some((vehicle) => vehicle.id === selectedId)
    ? selectedId
    : vehicles.find((vehicle) => vehicle.location)?.id ?? vehicles[0]?.id ?? null
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === resolvedSelectedId) ?? null
  const etaQuery = useQuery({
    queryKey: ['tracking', 'vehicle-eta', resolvedSelectedId],
    queryFn: () => selectedVehicle
      ? trackingService.getVehicleEta(selectedVehicle.id)
      : Promise.reject(new Error('Select a vehicle with a live location first.')),
    enabled: resolvedSelectedId !== null && selectedVehicle?.location !== null && selectedVehicle?.location !== undefined,
  })

  const selectVehicle = useCallback((vehicle: MonitoringVehicle) => {
    setSelectedId(vehicle.id)
    if (vehicle.location && mapRef.current) {
      const nextZoom = Math.max(mapRef.current.getZoom(), 13)
      mapRef.current.flyTo([vehicle.location.latitude, vehicle.location.longitude], nextZoom, { duration: 0.5 })
    }
  }, [])

  const onMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map
  }, [])

  const positions = useMemo(
    () => vehicles.flatMap((vehicle) => vehicle.location ? [[vehicle.location.latitude, vehicle.location.longitude] as [number, number]] : []),
    [vehicles],
  )
  const visibleCount = vehicles.filter((vehicle) => locationFreshness(vehicle.location, now) === 'fresh').length
  const movingCount = vehicles.filter((vehicle) => locationFreshness(vehicle.location, now) === 'fresh' && (vehicle.location?.speed ?? 0) > 0).length
  const idleCount = vehicles.filter((vehicle) => locationFreshness(vehicle.location, now) === 'fresh' && vehicle.location?.speed === 0).length
  const unavailableCount = fleetQuery.data ? Math.max(fleetQuery.data.total - visibleCount, 0) : '—'
  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch = vehicle.registrationNumber.toLowerCase().includes(search.trim().toLowerCase())
    return matchesSearch && (statusFilter === 'ALL' || vehicle.status === statusFilter)
  })

  if (liveQuery.isError) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-extrabold text-ink-900">Live vehicle tracking</h1>
        <ErrorState
          title="Tracking data unavailable"
          message={apiMessage(liveQuery.error)}
          action={<Button onClick={() => void liveQuery.refetch()}>Retry</Button>}
        />
      </div>
    )
  }

  const listPanel = (
    <VehicleList
      vehicles={vehicles}
      now={now}
      selectedId={resolvedSelectedId}
      search={search}
      statusFilter={statusFilter}
      onSearchChange={setSearch}
      onStatusChange={setStatusFilter}
      onSelect={selectVehicle}
    />
  )
  const detailPanel = (
    <VehicleDetails
      vehicle={selectedVehicle}
      eta={etaQuery.data}
      etaLoading={etaQuery.isLoading}
      now={now}
    />
  )

  return (
    <main className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">Fleet monitoring</p>
          <h1 className="mt-1 text-2xl font-extrabold text-ink-900 sm:text-3xl">Live vehicle tracking</h1>
          <p className="mt-1 text-sm text-ink-500">Monitor active trip locations and GPS freshness.</p>
        </div>
        <SocketIndicator status={socketStatus} />
      </header>

      {fleetQuery.isError && (
        <div role="alert" className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700">
          Fleet details could not be loaded: {apiMessage(fleetQuery.error)}
          <Button size="sm" variant="secondary" className="ml-3" onClick={() => void fleetQuery.refetch()}>Retry</Button>
        </div>
      )}

      <section aria-label="Tracking summary" className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard label="Registered fleet" value={fleetQuery.data?.total ?? '—'} note="Vehicles in the fleet register" icon={BusFront} tone="brand" />
        <SummaryCard label="Fresh GPS" value={visibleCount} note="Location received within 60 seconds" icon={Signal} tone="success" />
        <SummaryCard label="Moving / idle" value={`${movingCount} / ${idleCount}`} note="Fresh GPS reports with known speed" icon={Activity} tone="warning" />
        <SummaryCard label="Stale or unavailable" value={unavailableCount} note="No fresh position or no active-trip location" icon={SignalZero} tone="danger" />
      </section>

      {liveQuery.isLoading ? (
        <Card className="grid min-h-[420px] place-items-center text-sm text-ink-500">
          <span className="flex items-center gap-2"><RefreshCw size={17} className="animate-spin" /> Loading live vehicle locations…</span>
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="hidden xl:block">{listPanel}</aside>

          <Card className="order-first overflow-hidden xl:order-none">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
              <div>
                <h2 className="font-bold text-ink-900">Fleet map</h2>
                <p className="text-xs text-ink-500">{positions.length} vehicles with a current tracked location</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-500"><MapPin size={14} /> OpenStreetMap</span>
            </div>
            <div className="h-[min(62vh,680px)] min-h-[420px]">
              <MapContainer center={[-13.133897, 27.849332]} zoom={6} scrollWheelZoom className="h-full w-full">
                <MapView positions={positions} />
                <MapMapRef onReady={onMapReady} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {vehicles.map((vehicle) => {
                  const location = vehicle.location
                  if (!location || !isValidLocation(location)) return null
                  const freshness = locationFreshness(location, now)
                  const moving = (location.speed ?? 0) > 0
                  const color = freshness !== 'fresh' ? '#8b909b' : moving ? '#16a765' : '#f0a52b'
                  return (
                    <CircleMarker
                      key={vehicle.id}
                      center={[location.latitude, location.longitude]}
                      radius={resolvedSelectedId === vehicle.id ? 11 : 8}
                      pathOptions={{ color: resolvedSelectedId === vehicle.id ? '#ff5a2b' : '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 }}
                      eventHandlers={{ click: () => selectVehicle(vehicle) }}
                    >
                      <Popup>
                        <div className="min-w-40">
                          <p className="font-bold">{vehicle.registrationNumber}</p>
                          <p>{vehicle.location?.route?.origin ?? 'Route unavailable'} → {vehicle.location?.route?.destination ?? 'Route unavailable'}</p>
                          <p>{freshness === 'fresh' ? moving ? 'Moving' : 'Idle' : freshness === 'stale' ? 'Stale GPS' : 'No GPS'}</p>
                          <p>{formatSpeed(location.speed)}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )
                })}
              </MapContainer>
            </div>
          </Card>

          <aside className="hidden xl:block">{detailPanel}</aside>
        </section>
      )}

      {!liveQuery.isLoading && (
        <div className="space-y-3 xl:hidden">
          <details className="group">
            <summary className="cursor-pointer rounded-xl border border-ink-100 bg-ink-50 px-4 py-3 font-semibold text-ink-800">
              Vehicle list ({filteredVehicles.length})
            </summary>
            <div className="mt-3">{listPanel}</div>
          </details>
          <details className="group">
            <summary className="cursor-pointer rounded-xl border border-ink-100 bg-ink-50 px-4 py-3 font-semibold text-ink-800">
              Selected vehicle details
            </summary>
            <div className="mt-3">{detailPanel}</div>
          </details>
        </div>
      )}
    </main>
  )
}

function MapMapRef({ onReady }: { onReady: (map: LeafletMap) => void }) {
  const map = useMap()

  useEffect(() => {
    onReady(map)
  }, [map, onReady])

  return null
}
