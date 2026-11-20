import { useEffect, useRef, useState } from 'react'


import { divIcon, type LatLngExpression, type Marker as LeafletMarker } from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
// Component to draw a route between two points using Leaflet Routing Machine
function RouteDrawer({ from, to }: { from: LatLngExpression | null; to: LatLngExpression | null }) {
  const map = useMap();
  const controlRef = useRef<any>(null);

  useEffect(() => {
    // Remove previous control if any
    if (controlRef.current) {
      map.removeControl(controlRef.current);
      controlRef.current = null;
    }
    // Add routing control when both points are available
    if (from && to) {
      const control = (L as any).Routing.control({
        waypoints: [(L as any).latLng(from), (L as any).latLng(to)],
        lineOptions: { styles: [{ color: '#ff6600', weight: 4, opacity: 0.7 }] },
        createMarker: () => null, // suppress default markers
        routeWhileDragging: false,
        fitSelectedRoutes: false,
        show: false,
      }).addTo(map);
      controlRef.current = control;
    }
  }, [map, from, to]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controlRef.current) {
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
    };
  }, [map]);

  return null;
}


import { Crosshair, LoaderCircle, MapPin, Search, Trash2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { geocodingService, type GeocodingResult } from '@/services/geocoding'

type LocationPickerProps = {
  latitude: string
  longitude: string
  address: string
  onChange: (latitude: number, longitude: number, address?: string) => void
  onClear: () => void
  onAddressChange: (address: string) => void
}

const markerIcon = divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#f97316;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,.35);transform:rotate(-45deg)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 18],
})

function MapController({ position, hasPosition }: { position: LatLngExpression | null; hasPosition: boolean }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
  }, [map])
  useEffect(() => {
    if (position && hasPosition) map.setView(position, Math.max(map.getZoom(), 15), { animate: true })
  }, [map, position, hasPosition])
  return null
}

function MapClickHandler({ onSelect }: { onSelect: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

export function LocationPicker({ latitude, longitude, address, onChange, onClear, onAddressChange }: LocationPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [searching, setSearching] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [mapLoading, setMapLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const initialReverseRef = useRef('')
  const reverseRequestRef = useRef(0)
  const initialCoordinatesRef = useRef({ latitude, longitude })
  const initialAddressRef = useRef(address);
// Track previous location to draw route between successive points
const previousLocationRef = useRef<LatLngExpression | null>(null);

  const latitudeNumber = Number(latitude)
  const longitudeNumber = Number(longitude)
  const hasPosition = latitude !== ''
    && longitude !== ''
    && Number.isFinite(latitudeNumber)
    && latitudeNumber >= -90
    && latitudeNumber <= 90
    && Number.isFinite(longitudeNumber)
    && longitudeNumber >= -180
    && longitudeNumber <= 180
  useEffect(() => {
  if (hasPosition && position) {
    previousLocationRef.current = position as LatLngExpression;
  }
}, [position, hasPosition]);


  useEffect(() => {
    const initialCoordinates = initialCoordinatesRef.current
    if (
      !hasPosition
      || !initialCoordinates.latitude
      || !initialCoordinates.longitude
      || latitude !== initialCoordinates.latitude
      || longitude !== initialCoordinates.longitude
      || initialAddressRef.current
      || initialReverseRef.current === `${latitude},${longitude}`
    ) return
    initialReverseRef.current = `${latitude},${longitude}`
    const requestId = ++reverseRequestRef.current
    setGeocoding(true)
    geocodingService.reverse(latitudeNumber, longitudeNumber)
      .then((resolvedAddress) => {
        if (requestId === reverseRequestRef.current && resolvedAddress) onAddressChange(resolvedAddress)
      })
      .catch(() => {
        if (requestId === reverseRequestRef.current) {
          setGeoError('Address lookup failed. You can keep the pin and save with these captured coordinates.')
        }
      })
      .finally(() => {
        if (requestId === reverseRequestRef.current) setGeocoding(false)
      })
    return () => {
      if (requestId === reverseRequestRef.current) reverseRequestRef.current += 1
    }
  }, [hasPosition, latitude, latitudeNumber, longitude, longitudeNumber, onAddressChange])

  async function reverse(latitudeValue: number, longitudeValue: number) {
    const requestId = ++reverseRequestRef.current
    setGeocoding(true)
    setGeoError('')
    onChange(latitudeValue, longitudeValue)
    onAddressChange('')
    try {
      const resolvedAddress = await geocodingService.reverse(latitudeValue, longitudeValue)
      if (requestId === reverseRequestRef.current) onAddressChange(resolvedAddress ?? '')
    } catch {
      if (requestId === reverseRequestRef.current) {
        setGeoError('Address lookup failed. You can keep the pin and save with these captured coordinates.')
      }
    } finally {
      if (requestId === reverseRequestRef.current) setGeocoding(false)
    }
  }

  async function search() {
    const trimmed = query.trim()
    if (!trimmed) return
    setSearching(true)
    setGeoError('')
    setResults([])
    try {
      const matches = await geocodingService.search(trimmed)
      setResults(matches)
      if (!matches.length) setGeoError('No matching location was found. Try a nearby town or street name.')
    } catch {
      setGeoError('Location search failed. Please check your connection or select the point directly on the map.')
    } finally {
      setSearching(false)
    }
  }

  function selectSearchResult(result: GeocodingResult) {
    reverseRequestRef.current += 1
    setResults([])
    setGeoError('')
    setGeocoding(false)
    onAddressChange(result.displayName)
    onChange(result.latitude, result.longitude, result.displayName)
  }

  function clearLocation() {
    reverseRequestRef.current += 1
    setGeocoding(false)
    setGeoError('')
    onClear()
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoError('Browser geolocation is not available. Select a location directly on the map.')
      return
    }
    setLocating(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (positionResult) => {
        void reverse(positionResult.coords.latitude, positionResult.coords.longitude)
        setLocating(false)
      },
      () => {
        setGeoError('Current location could not be accessed. Select a location on the map instead.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    )
  }

  function dragMarker(marker: LeafletMarker) {
    const markerPosition = marker.getLatLng()
    void reverse(markerPosition.lat, markerPosition.lng)
  }

  return (
    <div className="space-y-3">
          <div
        className="flex min-w-0 gap-2"
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            void search();
          }
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search place, town, street or landmark..."
            className="h-11 w-full rounded-lg border border-ink-100 bg-ink-50 pl-9 pr-3 text-sm outline-none focus:border-brand-400"
            onKeyDown={(e)=>{if(e.key==='Enter'){e.preventDefault(); void search();}}}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={searching || !query.trim()}
          onClick={() => void search()}
        >
          {searching ? <LoaderCircle className="animate-spin" size={16} /> : <Search size={16} />}
          Search
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={useCurrentLocation}
          disabled={locating}
          aria-label="Use current location"
        >
          {locating ? <LoaderCircle className="animate-spin" size={16} /> : <Crosshair size={16} />}
          <span className="hidden sm:inline">Current</span>
        </Button>
      </div>

      {results.length > 0 && (
        <div className="max-h-36 overflow-y-auto rounded-lg border border-ink-100 bg-ink-950/30 p-1">
          {results.map((result) => (
            <button
              type="button"
              key={result.placeId}
              onClick={() => selectSearchResult(result)}
              className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-100"
            >
              <MapPin className="mt-0.5 shrink-0 text-brand-400" size={14} />
              <span>{result.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {geoError && <Notice tone="error" message={geoError} />}

      <div className="relative h-[280px] overflow-hidden rounded-xl border border-ink-100 sm:h-[320px]">
        {mapLoading && (
          <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-ink-950/60">
            <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700 shadow"><LoaderCircle className="animate-spin" size={16} />Loading map...</div>
          </div>
        )}
        <MapContainer
          center={position ?? ([-13.133897, 27.849332] as LatLngExpression)}
          zoom={position ? 15 : 6}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{ load: () => setMapLoading(false), tileerror: () => setMapLoading(false) }}
          />
          <MapController position={position} hasPosition={hasPosition} />
          <MapClickHandler onSelect={(latitudeValue, longitudeValue) => void reverse(latitudeValue, longitudeValue)} />
          {position && (
            <>
              <Marker
                position={position}
                icon={markerIcon}
                draggable
                eventHandlers={{ dragend: (event) => dragMarker(event.target as LeafletMarker) }}
              />
              {/* Draw route from previous location to current */}
              <RouteDrawer from={previousLocationRef.current} to={position} />
            </>
          )}
        </MapContainer>
      </div>

      <div className="flex min-h-12 items-start justify-between gap-3 rounded-lg border border-ink-100 bg-ink-950/20 px-3 py-2.5">
        <div className="min-w-0">
          {hasPosition ? (
            <>
              <p className="flex items-center gap-1 text-xs font-bold text-success-600"><MapPin size={13} />Location captured</p>
              <p className="mt-1 truncate font-mono text-xs text-ink-600">{latitudeNumber.toFixed(6)}, {longitudeNumber.toFixed(6)}</p>
              {address && <p className="mt-1 line-clamp-2 text-xs text-ink-500">{address}</p>}
            </>
          ) : (
            <p className="text-sm text-ink-500">Search or click the map to select a location.</p>
          )}
        </div>
        {hasPosition && (
          <button type="button" onClick={clearLocation} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-danger-500">
            <Trash2 size={13} />Clear
          </button>
        )}
      </div>
      {geocoding && <p className="flex items-center gap-2 text-xs text-ink-500"><LoaderCircle className="animate-spin" size={13} />Resolving selected address...</p>}
      <p className="text-[11px] leading-4 text-ink-500">Map data &copy; OpenStreetMap contributors. Search and address lookup are provided by Nominatim.</p>
    </div>
  )
}
