export type LiveVehicleLocation = {
  vehicleId: number
  tripId: number
  routeId: number
  latitude: number
  longitude: number
  speed: number | null
  heading: number | null
  isSimulated: boolean
  recordedAt: string
  vehicle?: {
    id: number
    registrationNumber: string
    vehicleName: string | null
    vehicleType: string
  }
  trip?: {
    id: number
    tripCode: string | null
    status: string
    scheduledArrival: string
  }
  route?: {
    id: number
    name: string
    origin: string
    destination: string
  }
}

export type VehicleLocationUpdate = Pick<
  LiveVehicleLocation,
  'vehicleId' | 'tripId' | 'routeId' | 'latitude' | 'longitude' | 'speed' | 'heading' | 'isSimulated' | 'recordedAt'
>

export type VehicleEta = {
  available: boolean
  remainingDistanceKm?: number
  estimatedRemainingMinutes?: number
  estimatedArrival?: string
  scheduledArrival?: string
  delayed?: boolean
  estimated?: boolean
}
