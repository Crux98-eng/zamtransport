import { api } from '@/services/api'

export type ReportType =
  | 'VEHICLE_UTILIZATION'
  | 'DRIVER_PERFORMANCE'
  | 'TRIP_COMPLETION'
  | 'ROUTE_PERFORMANCE'
  | 'TRIP_DELAYS'
  | 'VEHICLE_MAINTENANCE'
  | 'FLEET_OPERATIONAL'
  | 'USER_REGISTRATION'

export type ReportFormat = 'PDF' | 'XLSX' | 'CSV'
export type ReportStatus = 'COMPLETED' | 'FAILED'

export type Report = {
  id: string
  type: ReportType
  format: ReportFormat
  status: ReportStatus
  startDate: string | null
  endDate: string | null
  fileName: string | null
  errorMessage: string | null
  createdAt: string
  generatedBy?: { id: number; fullName: string; email: string }
}

export type GenerateReportInput = {
  reportType: ReportType
  format: ReportFormat
  startDate: string
  endDate: string
}

export const reportsService = {
  async list(params: { page: number; limit: number; reportType?: ReportType }) {
    const response = await api.get<{ data: { reports: Report[]; pagination: { page: number; limit: number; total: number; totalPages: number } } }>('/admin/reports', { params })
    return response.data.data
  },
  async generate(input: GenerateReportInput) {
    const response = await api.post<{ data: { report: Report } }>('/admin/reports/generate', input)
    return response.data.data.report
  },
  async download(report: Report) {
    const response = await api.get(`/admin/reports/${report.id}/download`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = report.fileName || `${report.type.toLowerCase()}.${report.format.toLowerCase()}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
}
