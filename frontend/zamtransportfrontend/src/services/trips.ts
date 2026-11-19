import { api } from '@/services/api'
import type { ApiEnvelope } from '@/types/api'
import type { Trip, TripListResponse, TripPayload, TripStatus } from '@/types/trips'

export const tripsService = {
  async list(params: { page?: number; limit?: number; tripCode?: string; tripStatus?: TripStatus; routeId?: number; scheduleId?: number }) {
    const response = await api.get<ApiEnvelope<TripListResponse>>('/admin/trips', { params })
    return response.data.data
  },
  async create(payload: TripPayload) {
    const response = await api.post<ApiEnvelope<{ trip: Trip }>>('/admin/trips', payload)
    return response.data.data.trip
  },
  async update(tripId: number, payload: { tripCode?: string | null; scheduledDeparture?: string; scheduledArrival?: string; delayReason?: string | null; revisedDeparture?: string | null; revisedArrival?: string | null }) {
    const response = await api.patch<ApiEnvelope<{ trip: Trip }>>(`/admin/trips/${tripId}`, payload)
    return response.data.data.trip
  },
  async assign(tripId: number, driverId: number, vehicleId: number) {
    const response = await api.patch<ApiEnvelope<{ trip: Trip }>>(`/admin/trips/${tripId}/assign`, { driverId, vehicleId })
    return response.data.data.trip
  },
  async updateStatus(tripId: number, payload: { status: TripStatus; reason?: string; revisedDeparture?: string; revisedArrival?: string }) {
    const response = await api.patch<ApiEnvelope<{ trip: Trip }>>(`/admin/trips/${tripId}/status`, payload)
    return response.data.data.trip
  },
  async cancel(tripId: number, reason: string) {
    const response = await api.patch<ApiEnvelope<{ trip: Trip }>>(`/admin/trips/${tripId}/cancel`, { reason })
    return response.data.data.trip
  },
  // ------- Driver‑side helpers --------
  async driverList(params: { page?: number; limit?: number; includePast?: boolean }) {
    const response = await api.get<ApiEnvelope<TripListResponse>>('/driver/trips', { params })
    return response.data.data
  },
  async accept(tripId: number) {
    const response = await api.patch<ApiEnvelope<{ trip: Trip }>>(`/driver/trips/${tripId}/accept`)
    return response.data.data.trip
  },
  async decline(tripId: number, reason: string) {
    const response = await api.patch<ApiEnvelope<{ trip: Trip }>>(`/driver/trips/${tripId}/decline`, { reason })
    return response.data.data.trip
  },
  async start(tripId: number) {
    const response = await api.patch<ApiEnvelope<{ trip: Trip }>>(`/driver/trips/${tripId}/start`)
    return response.data.data.trip
  },
  async complete(tripId: number) {
    const response = await api.patch<ApiEnvelope<{ trip: Trip }>>(`/driver/trips/${tripId}/complete`)
    return response.data.data.trip
  },
}
