import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LoaderCircle, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState, ErrorState } from '@/components/shared/PageState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Card } from '@/components/ui/Card'
import { apiMessage } from '@/services/api'
import { tripsService } from '@/services/trips'
import type { Trip, TripStatus } from '@/types/trips'

function statusTone(status: TripStatus) {
  if (status === 'DELAYED') return 'warning' as const
  if (status === 'BOARDING') return 'info' as const
  if (status === 'IN_PROGRESS') return 'success' as const
  if (status === 'CANCELLED') return 'danger' as const
  return 'neutral' as const
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Unavailable'
}

export function CommuterTripsPage() {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [tripCode, setTripCode] = useState('')

  const tripsQuery = useQuery({
    queryKey: ['commuter-trips', { page, tripCode }],
    queryFn: () => tripsService.commuterUpcomingList({ page, limit: 10, tripCode }),
  })

  const trips = tripsQuery.data?.trips ?? []
  const pagination = tripsQuery.data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled trips"
        description="View upcoming trips and their current status. You have read-only access."
        actions={<RefreshButton onRefresh={() => void tripsQuery.refetch()} refreshing={tripsQuery.isFetching} />}
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setPage(1)
                  setTripCode(searchInput.trim())
                }
              }}
              placeholder="Search trip code..."
              className="h-11 w-full rounded-lg border border-ink-100 bg-ink-50 pl-9 pr-3 text-sm outline-none focus:border-brand-400"
            />
          </div>
          <Button variant="secondary" onClick={() => { setPage(1); setTripCode(searchInput.trim()) }}>Search</Button>
        </div>
      </Card>

      {tripsQuery.isLoading && <Card className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-brand-400" size={28} /></Card>}
      {tripsQuery.isError && <ErrorState message={apiMessage(tripsQuery.error)} action={<button className="text-sm font-bold text-brand-400" onClick={() => void tripsQuery.refetch()}>Try again</button>} />}
      {tripsQuery.data && trips.length === 0 && <EmptyState title="No scheduled trips" message="There are no upcoming trips matching this view." />}

      {trips.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-ink-950 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3">Trip</th>
                  <th className="px-5 py-3">Route</th>
                  <th className="px-5 py-3">Departure</th>
                  <th className="px-5 py-3">Expected arrival</th>
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip: Trip) => (
                  <tr key={trip.id} className="border-t border-ink-100">
                    <td className="px-5 py-4 font-semibold text-ink-900">{trip.tripCode || `TRP-${trip.id}`}</td>
                    <td className="px-5 py-4 text-ink-700">{trip.route ? `${trip.route.origin} → ${trip.route.destination}` : `Route ${trip.routeId}`}</td>
                    <td className="px-5 py-4 text-ink-600">{formatDate(trip.revisedDeparture || trip.scheduledDeparture)}</td>
                    <td className="px-5 py-4 text-ink-600">{formatDate(trip.revisedArrival || trip.scheduledArrival)}</td>
                    <td className="px-5 py-4 text-ink-700">{trip.vehicle?.registrationNumber || 'Not assigned'}</td>
                    <td className="px-5 py-4"><Badge tone={statusTone(trip.status)}>{trip.status}</Badge></td>
                  </tr>
                ))}
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
    </div>
  )
}
