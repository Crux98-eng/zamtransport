import type { PaginationMeta } from './vehicles'

export type DriverStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING' | 'REJECTED'

export type DriverProfile = {
  id: number
  userId: number
  licenceNumber: string
  licenceExpiry: string
  address: string | null
}

export type Driver = {
  id: number
  fullName: string
  email: string
  phoneNumber: string | null
  role: 'DRIVER'
  status: DriverStatus
  createdAt: string
  approvedAt: string | null
  rejectedAt?: string | null
  suspendedAt?: string | null
  driverProfile?: DriverProfile | null
  assignments?: DriverVehicleAssignment[]
}

export type DriverVehicleAssignment = {
  id: number
  vehicleId: number
  driverId: number
  assignedAt: string
  endedAt: string | null
  vehicle?: {
    id: number
    registrationNumber: string
    vehicleType: string
    vehicleName?: string | null
    status?: string
    capacity?: number
  }
}

export type DriverTrip = {
  id: number
  tripCode: string
  status: string
  scheduledDeparture: string
  scheduledArrival: string
  actualDeparture?: string | null
  actualArrival?: string | null
  route?: {
    id: number
    name: string
    origin: string
    destination: string
  } | null
  vehicle?: {
    id: number
    registrationNumber: string
    vehicleType: string
  } | null
  schedule?: {
    id: number
    departureTime: string
  } | null
}

export type DriverCreatePayload = {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  licenceNumber: string
  licenceExpiry: string
  phoneNumber?: string
  address?: string
}

export type DriverUpdatePayload = {
  fullName?: string
  phoneNumber?: string | null
  address?: string | null
  licenceNumber?: string
  licenceExpiry?: string
}

export type DriverQueryParams = {
  page?: number
  limit?: number
  search?: string
  status?: string
}

export type DriversListResponse = {
  drivers: Driver[]
  pagination: PaginationMeta
}
