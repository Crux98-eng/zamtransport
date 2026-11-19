export type RouteStatus = 'ACTIVE' | 'INACTIVE'

export type Stop = {
  id: number
  name: string
  description: string | null
  latitude: number | string
  longitude: number | string
  createdAt?: string
  updatedAt?: string
}

export type RouteStop = {
  id: number
  routeId: number
  stopId: number
  sequence: number
  estimatedMinutesFromStart: number | null
  stop: Stop
}

export type TransportRoute = {
  id: number
  name: string
  routeCode: string | null
  origin: string
  destination: string
  originStopId: number | null
  destinationStopId: number | null
  originStop?: Stop | null
  destinationStop?: Stop | null
  description: string | null
  distanceKm: number | string | null
  estimatedDuration: number | null
  status: RouteStatus
  createdAt?: string
  updatedAt?: string
  routeStops?: RouteStop[]
}

export type RoutePayload = {
  name: string
  routeCode: string | null
  originStopId: number
  destinationStopId: number
  description: string | null
  distanceKm: number | null
  estimatedDuration: number | null
}

export type RouteStopPayload = {
  stopId: number
  sequence: number
  estimatedMinutesFromStart: number | null
}
