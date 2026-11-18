import { api } from '@/services/api'
import type { ApiEnvelope } from '@/types/api'
import type { Schedule, ScheduleGenerationResult, SchedulePayload, ScheduleRoute, ScheduleStatus } from '@/types/schedules'

type ScheduleListResponse = {
  schedules: Schedule[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

type RoutesListResponse = {
  routes: ScheduleRoute[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export const schedulesService = {
  async list(params: { page: number; limit: number; search?: string; status?: ScheduleStatus }) {
    const response = await api.get<ApiEnvelope<ScheduleListResponse>>('/admin/schedules', { params })
    return response.data.data
  },

  async listRoutes(page = 1) {
    const response = await api.get<ApiEnvelope<RoutesListResponse>>('/routes', {
      params: { page, limit: 100 },
    })
    return response.data.data
  },

  async create(payload: SchedulePayload) {
    const response = await api.post<ApiEnvelope<{ schedule: Schedule }>>('/admin/schedules', payload)
    return response.data.data.schedule
  },

  async update(scheduleId: number, payload: Partial<SchedulePayload>) {
    const response = await api.patch<ApiEnvelope<{ schedule: Schedule }>>(`/admin/schedules/${scheduleId}`, payload)
    return response.data.data.schedule
  },

  async updateStatus(scheduleId: number, status: ScheduleStatus) {
    const response = await api.patch<ApiEnvelope<{ schedule: Schedule }>>(
      `/admin/schedules/${scheduleId}/status`,
      { status },
    )
    return response.data.data.schedule
  },

  async delete(scheduleId: number) {
    await api.delete(`/admin/schedules/${scheduleId}`)
  },

  async generateTrips(payload: { scheduleId?: number; startDate: string; endDate: string }) {
    const response = await api.post<ApiEnvelope<ScheduleGenerationResult>>('/admin/trips/generate', payload)
    return response.data.data
  },
}
