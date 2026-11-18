export type VehicleStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'

export type Vehicle = {
  id: number
  registrationNumber: string
  vehicleName: string | null
  manufacturer: string | null
  model: string | null
  vehicleType: string
  capacity: number
  manufactureYear: number | null
  description: string | null
  status: VehicleStatus
  createdAt: string
  updatedAt: string
}

export type VehicleAssignmentDriver = {
  id: number
  fullName: string
  email: string
  status?: string
}

export type VehicleAssignment = {
  id: number
  vehicleId: number
  driverId: number
  assignedAt: string
  endedAt: string | null
  createdAt?: string
  driver: VehicleAssignmentDriver
}

export type VehicleListItem = Vehicle & {
  assignments: VehicleAssignment[]
  _count: {
    trips: number
    maintenanceRecords: number
  }
}

export type VehicleTripSummary = {
  id: number
  tripCode: string
  status: string
  scheduledDeparture: string
  scheduledArrival: string
  actualDeparture?: string | null
  actualArrival?: string | null
}

export type VehicleMaintenanceRecord = {
  id: number
  maintenanceType: string
  description: string
  cost?: number | string | null
  maintenanceDate: string
  status?: string
}

export type VehicleDetail = Vehicle & {
  assignments: VehicleAssignment[]
  trips: VehicleTripSummary[]
  maintenanceRecords: VehicleMaintenanceRecord[]
}

export type VehicleRegistrationPayload = {
  registrationNumber: string
  vehicleType: string
  capacity: number
  vehicleName?: string | null
  manufacturer?: string | null
  model?: string | null
  manufactureYear?: number | null
  description?: string | null
}

export type VehicleUpdatePayload = Partial<VehicleRegistrationPayload>

export type VehicleQueryParams = {
  page?: number
  limit?: number
  search?: string
  status?: VehicleStatus | 'ALL'
  vehicleType?: string
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type VehiclesListResponse = {
  vehicles: VehicleListItem[]
  pagination: PaginationMeta
}
