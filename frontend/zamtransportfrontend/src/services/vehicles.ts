import { api } from '@/services/api'
import type { ApiEnvelope } from '@/types/api'
import type {
  Vehicle,
  VehicleDetail,
  VehicleQueryParams,
  VehicleRegistrationPayload,
  VehicleUpdatePayload,
  VehicleStatus,
  VehiclesListResponse,
  VehicleAssignment,
} from '@/types/vehicles'

export type DriverOption = {
  id: number
  fullName: string
  email: string
  phoneNumber: string | null
  status: string
  driverProfile?: {
    licenceNumber: string
    licenceExpiry: string
  } | null
}

export const vehiclesService = {
  async list(params: VehicleQueryParams = {}) {
    const cleanParams: Record<string, string | number> = {}
    if (params.page) cleanParams.page = params.page
    if (params.limit) cleanParams.limit = params.limit
    if (params.search && params.search.trim()) cleanParams.search = params.search.trim()
    if (params.status && params.status !== 'ALL') cleanParams.status = params.status
    if (params.vehicleType && params.vehicleType.trim()) cleanParams.vehicleType = params.vehicleType.trim()

    const response = await api.get<ApiEnvelope<VehiclesListResponse>>('/admin/vehicles', {
      params: cleanParams,
    })
    return response.data
  },

  async get(vehicleId: number) {
    const response = await api.get<ApiEnvelope<{ vehicle: VehicleDetail }>>(`/admin/vehicles/${vehicleId}`)
    return response.data
  },

  async register(payload: VehicleRegistrationPayload) {
    const response = await api.post<ApiEnvelope<{ vehicle: Vehicle }>>('/admin/vehicles', payload)
    return response.data
  },

  async update(vehicleId: number, payload: VehicleUpdatePayload) {
    const response = await api.patch<ApiEnvelope<{ vehicle: Vehicle }>>(`/admin/vehicles/${vehicleId}`, payload)
    return response.data
  },

  async updateStatus(vehicleId: number, status: VehicleStatus) {
    const response = await api.patch<ApiEnvelope<{ vehicle: Vehicle }>>(
      `/admin/vehicles/${vehicleId}/status`,
      { status },
    )
    return response.data
  },

  async delete(vehicleId: number) {
    const response = await api.delete<ApiEnvelope<{ message?: string }>>(`/admin/vehicles/${vehicleId}`)
    return response.data
  },

  async getAssignments(vehicleId: number) {
    const response = await api.get<ApiEnvelope<{ assignments: VehicleAssignment[] }>>(
      `/admin/vehicles/${vehicleId}/assignments`,
    )
    return response.data
  },

  async assignDriver(payload: { vehicleId: number; driverId: number; assignedAt?: string }) {
    const response = await api.post<ApiEnvelope<{ assignment: VehicleAssignment }>>(
      '/admin/assignments',
      payload,
    )
    return response.data
  },

  async endAssignment(assignmentId: number) {
    const response = await api.patch<ApiEnvelope<{ assignment: VehicleAssignment }>>(
      `/admin/assignments/${assignmentId}/end`,
    )
    return response.data
  },

  async listDrivers(params: { search?: string; limit?: number } = {}) {
    const response = await api.get<ApiEnvelope<{ drivers: DriverOption[] }>>('/admin/drivers', {
      params: { limit: params.limit ?? 100, search: params.search },
    })
    return response.data
  },
}
