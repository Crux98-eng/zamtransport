export type TripStatus = 'SCHEDULED' | 'BOARDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | 'CANCELLED'

export type Trip = {
  id: number
  tripCode: string | null
  scheduleId: number
  routeId: number
  vehicleId: number | null
  driverId: number | null
  scheduledDeparture: string
  scheduledArrival: string
  actualDeparture: string | null
  actualArrival: string | null
  revisedDeparture: string | null
  revisedArrival: string | null
  status: TripStatus
  delayReason: string | null
  cancellationReason: string | null
  route?: { id: number; name: string; origin: string; destination: string } | null
  vehicle?: { id: number; registrationNumber: string; vehicleName: string | null; vehicleType: string } | null
  driver?: { id: number; fullName: string; email: string } | null
  schedule?: { id: number; departureTime: string } | null
}

export type TripPayload = {
  scheduleId: number
  routeId?: number
  tripCode?: string | null
  vehicleId?: number
  driverId?: number
  scheduledDeparture: string
  scheduledArrival: string
}

export type TripListResponse = {
  trips: Trip[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}
