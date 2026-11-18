import { api } from '@/services/api'
import type { ApiEnvelope } from '@/types/api'
import type { Stop } from '@/types/routes'

type StopListResponse = {
  stops: Stop[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export type StopPayload = {
  name: string
  description: string | null
  latitude: number
  longitude: number
}

export const terminalsService = {
  async list(params: { page?: number; limit?: number; search?: string }) {
    const response = await api.get<ApiEnvelope<StopListResponse>>('/stops', { params })
    return response.data.data
  },
  async get(stopId: number) {
    const response = await api.get<ApiEnvelope<{ stop: Stop }>>(`/stops/${stopId}`)
    return response.data.data.stop
  },
  async create(payload: StopPayload) {
    const response = await api.post<ApiEnvelope<{ stop: Stop }>>('/admin/stops', payload)
    return response.data.data.stop
  },
  async update(stopId: number, payload: Partial<StopPayload>) {
    const response = await api.patch<ApiEnvelope<{ stop: Stop }>>(`/admin/stops/${stopId}`, payload)
    return response.data.data.stop
  },
  async delete(stopId: number) {
    await api.delete(`/admin/stops/${stopId}`)
  },
}
