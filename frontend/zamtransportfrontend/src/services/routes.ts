import { api } from '@/services/api'
import type { ApiEnvelope } from '@/types/api'
import type { RoutePayload, RouteStop, RouteStopPayload, Stop, TransportRoute } from '@/types/routes'

type RouteListResponse = {
  routes: TransportRoute[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

type StopListResponse = {
  stops: Stop[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export const routesService = {
  async list(params: { page: number; limit: number; search?: string }) {
    const response = await api.get<ApiEnvelope<RouteListResponse>>('/routes', { params })
    return response.data.data
  },

  async get(routeId: number) {
    const response = await api.get<ApiEnvelope<{ route: TransportRoute }>>(`/routes/${routeId}`)
    return response.data.data.route
  },

  async listStops(page: number) {
    const response = await api.get<ApiEnvelope<StopListResponse>>('/stops', {
      params: { page, limit: 100 },
    })
    return response.data.data
  },

  async create(payload: RoutePayload) {
    const response = await api.post<ApiEnvelope<{ route: TransportRoute }>>('/admin/routes', payload)
    return response.data.data.route
  },

  async update(routeId: number, payload: RoutePayload) {
    const response = await api.patch<ApiEnvelope<{ route: TransportRoute }>>(`/admin/routes/${routeId}`, payload)
    return response.data.data.route
  },

  async delete(routeId: number) {
    await api.delete(`/admin/routes/${routeId}`)
  },

  async attachStop(routeId: number, payload: RouteStopPayload) {
    const response = await api.post<ApiEnvelope<{ routeStop: RouteStop }>>(`/admin/routes/${routeId}/stops`, payload)
    return response.data.data.routeStop
  },

  async reorderStops(routeId: number, stops: Array<{ stopId: number; sequence: number }>) {
    const response = await api.patch<ApiEnvelope<{ stops: RouteStop[] }>>(
      `/admin/routes/${routeId}/stops/reorder`,
      { stops },
    )
    return response.data.data.stops
  },

  async detachStop(routeId: number, stopId: number) {
    await api.delete(`/admin/routes/${routeId}/stops/${stopId}`)
  },
}
