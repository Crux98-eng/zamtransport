import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState, ErrorState } from '@/components/shared/PageState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { apiMessage } from '@/services/api'
import { tripsService } from '@/services/trips'
import type { Trip, TripStatus } from '@/types/trips'

type TripAction = 'accept' | 'start' | 'complete'

function statusTone(status: TripStatus) {
  if (status === 'COMPLETED') return 'success' as const
  if (status === 'CANCELLED') return 'danger' as const
  if (status === 'DELAYED') return 'warning' as const
  if (status === 'IN_PROGRESS' || status === 'BOARDING') return 'info' as const
  return 'neutral' as const
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Unavailable'
}

function tripActionLabel(status: TripStatus) {
  if (status === 'SCHEDULED') return 'Accept trip'
  if (status === 'BOARDING' || status === 'DELAYED') return 'Start trip'
  if (status === 'IN_PROGRESS') return 'End trip'
  return null
}

function tripAction(status: TripStatus): TripAction | null {
  if (status === 'SCHEDULED') return 'accept'
  if (status === 'BOARDING' || status === 'DELAYED') return 'start'
  if (status === 'IN_PROGRESS') return 'complete'
  return null
}

function runTripAction(tripId: number, action: TripAction) {
  if (action === 'accept') return tripsService.accept(tripId)
  if (action === 'start') return tripsService.start(tripId)
  return tripsService.complete(tripId)
}

export function DriverTripsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const tripsQuery = useQuery({
    queryKey: ['driver-trips', { page }],
    queryFn: () => tripsService.driverList({ page, limit: 10 }),
  })

  const actionMutation = useMutation({
    mutationFn: ({ tripId, action }: { tripId: number; action: TripAction }) => runTripAction(tripId, action),
    onSuccess: async (_trip, variables) => {
      const message = variables.action === 'accept'
        ? 'Trip accepted and ready for boarding.'
        : variables.action === 'start'
          ? 'Trip started.'
          : 'Trip completed.'
      setFeedback({ tone: 'success', message })
      setPage(1)
      await queryClient.invalidateQueries({ queryKey: ['driver-trips'] })
    },
    onError: (error) => setFeedback({ tone: 'error', message: apiMessage(error) }),
  })

  const trips = tripsQuery.data?.trips ?? []
  const pagination = tripsQuery.data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader
        title="My trips"
        description="Accept a scheduled trip, start it when boarding is complete, and end it on arrival."
        actions={<RefreshButton onRefresh={() => void tripsQuery.refetch()} refreshing={tripsQuery.isFetching} />}
      />
      {feedback && <Notice tone={feedback.tone}>{feedback.message}</Notice>}
      {tripsQuery.isLoading && <Card className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-brand-400" size={28} /></Card>}
      {tripsQuery.isError && <ErrorState message={apiMessage(tripsQuery.error)} action={<button className="text-sm font-bold text-brand-400" onClick={() => void tripsQuery.refetch()}>Try again</button>} />}
      {tripsQuery.data && trips.length === 0 && <EmptyState title="No assigned trips" message="Trips assigned to you will appear here." />}
      {trips.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-950 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3">Trip</th>
                  <th className="px-5 py-3">Route</th>
                  <th className="px-5 py-3">Departure / arrival</th>
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip: Trip) => {
                  const action = tripAction(trip.status)
                  const actionLabel = tripActionLabel(trip.status)
                  const isPending = actionMutation.isPending && actionMutation.variables?.tripId === trip.id
                  return (
                    <tr key={trip.id} className="border-t border-ink-100">
                      <td className="px-5 py-4 font-semibold text-ink-900">{trip.tripCode || `TRP-${trip.id}`}</td>
                      <td className="px-5 py-4 text-ink-700">{trip.route ? `${trip.route.origin} → ${trip.route.destination}` : `Route ${trip.routeId}`}</td>
                      <td className="px-5 py-4 text-ink-600">
                        <p>{formatDate(trip.scheduledDeparture)}</p>
                        <p className="mt-1 text-xs text-ink-500">Arrives {formatDate(trip.scheduledArrival)}</p>
                      </td>
                      <td className="px-5 py-4 text-ink-700">{trip.vehicle?.registrationNumber || 'Not assigned'}</td>
                      <td className="px-5 py-4"><Badge tone={statusTone(trip.status)}>{trip.status}</Badge></td>
                      <td className="px-5 py-4 text-right">
                        {action && actionLabel
                          ? <Button size="sm" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ tripId: trip.id, action })}>{isPending ? 'Updating...' : actionLabel}</Button>
                          : <span className="text-xs text-ink-500">No action available</span>}
                      </td>
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
    </div>
  )
}
