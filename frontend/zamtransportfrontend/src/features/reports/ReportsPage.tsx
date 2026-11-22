import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileBarChart, LoaderCircle, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState, ErrorState } from '@/components/shared/PageState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Notice } from '@/components/ui/Notice'
import { apiMessage } from '@/services/api'
import { reportsService, type ReportFormat, type ReportType } from '@/services/reports'

const reportTypes: { value: ReportType; label: string; description: string }[] = [
  { value: 'TRIP_COMPLETION', label: 'Trip completion', description: 'Completed, cancelled, and overall trip outcomes.' },
  { value: 'DRIVER_PERFORMANCE', label: 'Driver performance', description: 'Trips, completion, delays, and distance by driver.' },
  { value: 'VEHICLE_UTILIZATION', label: 'Vehicle utilization', description: 'Fleet availability and vehicle usage.' },
  { value: 'ROUTE_PERFORMANCE', label: 'Route performance', description: 'Trip volume and journey metrics by route.' },
  { value: 'TRIP_DELAYS', label: 'Trip delays', description: 'Delayed trips and delay trends.' },
  { value: 'VEHICLE_MAINTENANCE', label: 'Vehicle maintenance', description: 'Maintenance records, costs, and status.' },
  { value: 'FLEET_OPERATIONAL', label: 'Fleet operations', description: 'Current operational fleet summary.' },
  { value: 'USER_REGISTRATION', label: 'User registration', description: 'Account registrations and approval status.' },
]

const inputClass = 'mt-1.5 h-11 w-full rounded-lg border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 outline-none focus:border-brand-400'

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayInput() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date) : value
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : value
}

export function ReportsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<ReportType | 'ALL'>('ALL')
  const [createOpen, setCreateOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [values, setValues] = useState({ reportType: 'TRIP_COMPLETION' as ReportType, format: 'PDF' as ReportFormat, startDate: firstDayInput(), endDate: todayInput() })

  const reportsQuery = useQuery({
    queryKey: ['reports', { page, typeFilter }],
    queryFn: () => reportsService.list({ page, limit: 10, ...(typeFilter === 'ALL' ? {} : { reportType: typeFilter }) }),
  })

  const generateMutation = useMutation({
    mutationFn: () => reportsService.generate(values),
    onSuccess: async (report) => {
      setCreateOpen(false)
      setFeedback({ tone: 'success', message: report.status === 'COMPLETED' ? 'Report generated successfully.' : 'Report generation failed.' })
      await queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (error) => setFormError(apiMessage(error)),
  })

  const downloadMutation = useMutation({
    mutationFn: (reportId: string) => {
      const report = reportsQuery.data?.reports.find((item) => item.id === reportId)
      if (!report) return Promise.reject(new Error('Report not found'))
      return reportsService.download(report)
    },
    onError: (error) => setFeedback({ tone: 'error', message: apiMessage(error) }),
  })

  function openCreate() {
    setValues({ reportType: 'TRIP_COMPLETION', format: 'PDF', startDate: firstDayInput(), endDate: todayInput() })
    setFormError('')
    setCreateOpen(true)
  }

  function submitGenerate(event?: FormEvent) {
    event?.preventDefault()
    if (!values.startDate || !values.endDate) {
      setFormError('Choose both a start date and end date.')
      return
    }
    if (values.endDate < values.startDate) {
      setFormError('End date must be on or after start date.')
      return
    }
    setFormError('')
    generateMutation.mutate()
  }

  const reports = reportsQuery.data?.reports ?? []
  const pagination = reportsQuery.data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate, review, and download administrative reports."
        actions={<><RefreshButton onRefresh={() => void reportsQuery.refetch()} refreshing={reportsQuery.isFetching} /><Button onClick={openCreate}><Plus size={16} />Generate report</Button></>}
      />

      {feedback && <Notice tone={feedback.tone} message={feedback.message} />}

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="text-xs font-bold uppercase tracking-wide text-ink-500">Report type</label>
            <select value={typeFilter} onChange={(event) => { setPage(1); setTypeFilter(event.target.value as ReportType | 'ALL') }} className={inputClass}>
              <option value="ALL">All report types</option>
              {reportTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {reportsQuery.isLoading && <Card className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-brand-400" size={28} /></Card>}
      {reportsQuery.isError && <ErrorState message={apiMessage(reportsQuery.error)} action={<button className="text-sm font-bold text-brand-400" onClick={() => void reportsQuery.refetch()}>Try again</button>} />}
      {reportsQuery.data && reports.length === 0 && <EmptyState title="No reports found" message="Generate your first administrative report." />}

      {reports.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-ink-950 text-xs uppercase tracking-wide text-ink-500">
                <tr><th className="px-5 py-3">Report</th><th className="px-5 py-3">Period</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const type = reportTypes.find((item) => item.value === report.type)
                  return (
                    <tr key={report.id} className="border-t border-ink-100">
                      <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-500"><FileBarChart size={17} /></span><div><p className="font-semibold text-ink-900">{type?.label || report.type.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-ink-500">{report.format} · {report.generatedBy?.fullName || 'Administrator'}</p></div></div></td>
                      <td className="px-5 py-4 text-ink-600">{formatDate(report.startDate)}<br /><span className="text-xs text-ink-400">to {formatDate(report.endDate)}</span></td>
                      <td className="px-5 py-4 text-ink-600">{formatTimestamp(report.createdAt)}</td>
                      <td className="px-5 py-4"><Badge tone={report.status === 'COMPLETED' ? 'success' : 'danger'}>{report.status}</Badge>{report.errorMessage && <p className="mt-1 max-w-48 truncate text-xs text-danger-500" title={report.errorMessage}>{report.errorMessage}</p>}</td>
                      <td className="px-5 py-4 text-right"><Button variant="secondary" size="sm" disabled={report.status !== 'COMPLETED' || downloadMutation.isPending} onClick={() => downloadMutation.mutate(report.id)}><Download size={15} />Download</Button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="grid h-9 place-items-center px-2 text-sm text-ink-500">{page} / {pagination.totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Generate report"
        description="Choose the report scope and output format."
        size="xl"
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => submitGenerate()} disabled={generateMutation.isPending}>{generateMutation.isPending ? 'Generating...' : 'Generate report'}</Button></>}
      >
        <form onSubmit={submitGenerate} className="space-y-5">
          {formError && <Notice tone="error" message={formError} />}
          <div>
            <label className="text-sm font-semibold text-ink-700">Report type</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {reportTypes.map((type) => (
                <button key={type.value} type="button" onClick={() => setValues({ ...values, reportType: type.value })} className={`rounded-xl border p-3 text-left transition ${values.reportType === type.value ? 'border-brand-400 bg-brand-50' : 'border-ink-100 hover:border-ink-300'}`}>
                  <p className="text-sm font-bold text-ink-900">{type.label}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-500">{type.description}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="text-sm font-semibold text-ink-700">Start date</label><input type="date" value={values.startDate} onChange={(event) => setValues({ ...values, startDate: event.target.value })} className={inputClass} /></div>
            <div><label className="text-sm font-semibold text-ink-700">End date</label><input type="date" value={values.endDate} onChange={(event) => setValues({ ...values, endDate: event.target.value })} className={inputClass} /></div>
          </div>
          <div>
            <label className="text-sm font-semibold text-ink-700">File format</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['PDF', 'XLSX', 'CSV'] as ReportFormat[]).map((format) => (
                <button key={format} type="button" onClick={() => setValues({ ...values, format })} className={`h-11 rounded-lg border text-sm font-bold ${values.format === format ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-ink-100 text-ink-600 hover:border-ink-300'}`}>{format}</button>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
