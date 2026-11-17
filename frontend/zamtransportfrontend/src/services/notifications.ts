import { api } from '@/services/api'
import type { ApiEnvelope } from '@/types/api'

export type Notification = { id: number; title: string; message: string; type: string; isRead: boolean; readAt: string | null; createdAt: string }
type Pagination = { page: number; limit: number; total: number; totalPages: number }
export const notificationService = {
  async unreadCount() { return (await api.get<ApiEnvelope<{ count: number }>>('/notifications/unread-count')).data },
  async list(params: { page?: number; limit?: number; read?: boolean } = {}) { return (await api.get<ApiEnvelope<{ notifications: Notification[]; pagination: Pagination }>>('/notifications', { params: { ...params, read: params.read === undefined ? undefined : String(params.read) } })).data },
  async markRead(id: number) { return (await api.patch<ApiEnvelope<{ notification: Notification }>>(`/notifications/${id}/read`)).data },
  async markAllRead() { return (await api.patch<ApiEnvelope<{ updated: number }>>('/notifications/read-all')).data },
}
