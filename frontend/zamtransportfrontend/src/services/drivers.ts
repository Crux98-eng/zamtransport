import { api } from '@/services/api'
import type { ApiEnvelope } from '@/types/api'
import type {
  Driver,
  DriverCreatePayload,
  DriverUpdatePayload,
  DriverQueryParams,
  DriversListResponse,
  DriverTrip,
  DriverVehicleAssignment,
} from '@/types/drivers'
import type { VehicleListItem } from '@/types/vehicles'

export const driversService = {
  async list(params: DriverQueryParams = {}) {
    const cleanParams: Record<string, string | number> = {}
    if (params.page) cleanParams.page = params.page
    if (params.limit) cleanParams.limit = params.limit
    if (params.search && params.search.trim()) cleanParams.search = params.search.trim()

    const response = await api.get<ApiEnvelope<DriversListResponse>>('/admin/drivers', {
      params: cleanParams,
    })
    return response.data
  },

  async get(driverId: number) {
    const response = await api.get<ApiEnvelope<{ driver: Driver }>>(`/admin/drivers/${driverId}`)
    return response.data
  },

  async register(payload: DriverCreatePayload) {
    const response = await api.post<ApiEnvelope<{ driver: Driver }>>('/admin/drivers', payload)
    return response.data
  },

  async update(driverId: number, payload: DriverUpdatePayload) {
    const response = await api.patch<ApiEnvelope<{ driver: Driver }>>(`/admin/drivers/${driverId}`, payload)
    return response.data
  },

  async updateStatus(driverId: number, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    const response = await api.patch<ApiEnvelope<{ driver: Driver }>>(
      `/admin/drivers/${driverId}/status`,
      { status },
    )
    return response.data
  },

  async getTrips(driverId: number, params: { page?: number; limit?: number } = {}) {
    const response = await api.get<ApiEnvelope<{ trips: DriverTrip[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>>(
      `/admin/drivers/${driverId}/trips`,
      { params },
    )
    return response.data
  },

  async getAssignments(driverId: number) {
    const response = await api.get<ApiEnvelope<{ assignments: DriverVehicleAssignment[] }>>(
      `/admin/drivers/${driverId}/assignments`,
    )
    return response.data
  },

  async assignVehicle(payload: { driverId: number; vehicleId: number; assignedAt?: string }) {
    const response = await api.post<ApiEnvelope<{ assignment: DriverVehicleAssignment }>>(
      '/admin/assignments',
      payload,
    )
    return response.data
  },

  async endAssignment(assignmentId: number) {
    const response = await api.patch<ApiEnvelope<{ assignment: DriverVehicleAssignment }>>(
      `/admin/assignments/${assignmentId}/end`,
    )
    return response.data
  },

  async listVehicles(params: { status?: string; limit?: number } = {}) {
    const response = await api.get<ApiEnvelope<{ vehicles: VehicleListItem[] }>>('/admin/vehicles', {
      params: { limit: params.limit ?? 100, status: params.status ?? 'ACTIVE' },
    })
    return response.data
  },
}
