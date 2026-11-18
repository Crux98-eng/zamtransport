export type GeocodingResult = {
  placeId: string
  displayName: string
  latitude: number
  longitude: number
}

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
const NOMINATIM_MIN_INTERVAL_MS = 1000
let requestQueue: Promise<void> = Promise.resolve()
let lastRequestAt = 0

async function readJson<T>(url: string): Promise<T> {
  const request = requestQueue.then(async () => {
    const wait = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastRequestAt))
    if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait))
    lastRequestAt = Date.now()

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`Geocoding request failed (${response.status}).`)
    return response.json() as Promise<T>
  })
  requestQueue = request.then(() => undefined, () => undefined)
  return request
}

export const geocodingService = {
  async search(query: string): Promise<GeocodingResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []
    const params = new URLSearchParams({
      q: trimmed,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'zm',
    })
    const results = await readJson<Array<{ place_id: number; display_name: string; lat: string; lon: string }>>(
      `${NOMINATIM_BASE_URL}/search?${params.toString()}`,
    )
    return results.map((result) => ({
      placeId: String(result.place_id),
      displayName: result.display_name,
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    })).filter((result) => Number.isFinite(result.latitude)
      && result.latitude >= -90
      && result.latitude <= 90
      && Number.isFinite(result.longitude)
      && result.longitude >= -180
      && result.longitude <= 180)
  },

  async reverse(latitude: number, longitude: number): Promise<string | null> {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'jsonv2',
      addressdetails: '1',
    })
    const result = await readJson<{ display_name?: string }>(
      `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`,
    )
    return result.display_name?.trim() || null
  },
}
