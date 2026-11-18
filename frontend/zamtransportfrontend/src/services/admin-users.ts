import { api } from '@/services/api'
import type { ApiEnvelope, User } from '@/types/api'

export type PendingUsersPage = {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export const adminUsersService = {
  async listPending(params: { page: number; limit: number; search?: string }) {
    const response = await api.get<ApiEnvelope<PendingUsersPage>>('/admin/users/pending', { params })
    return response.data.data
  },

  async approve(userId: number) {
    const response = await api.patch<ApiEnvelope<{ user: User }>>(`/admin/users/${userId}/approve`)
    return response.data
  },

  async reject(userId: number, reason?: string) {
    const response = await api.patch<ApiEnvelope<{ user: User }>>(
      `/admin/users/${userId}/reject`,
      reason ? { reason } : {},
    )
    return response.data
  },
}
