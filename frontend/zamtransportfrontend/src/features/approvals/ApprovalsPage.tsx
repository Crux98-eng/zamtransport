import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Search, UserRound, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState } from '@/components/shared/PageState'
import { PageHeader } from '@/components/shared/PageHeader'
import { adminUsersService } from '@/services/admin-users'
import { apiMessage } from '@/services/api'
import type { User } from '@/types/api'

type Decision = { user: User; action: 'approve' | 'reject' }
type MutationVariables = { userId: number; action: Decision['action']; reason: string }

function formatRegistrationDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function ApprovalsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const pendingQuery = useQuery({
    queryKey: ['admin-users', 'pending', { page, search }],
    queryFn: () => adminUsersService.listPending({ page, limit: 10, search }),
  })

  const decisionMutation = useMutation({
    mutationFn: ({ userId, action, reason: rejectionReason }: MutationVariables) => (
      action === 'approve'
        ? adminUsersService.approve(userId)
        : adminUsersService.reject(userId, rejectionReason.trim() || undefined)
    ),
    onSuccess: async (result, variables) => {
      const deliveryFailed = result.data.emailAccepted === false
      const actionMessage = variables.action === 'approve' ? 'Account approved.' : 'Account rejected.'
      setFeedback({
        tone: deliveryFailed ? 'error' : 'success',
        message: deliveryFailed ? `${actionMessage} The email provider did not accept the notification; check the email service configuration.` : actionMessage,
      })
      setDecision(null)
      setReason('')
      setReasonError('')
      if (page > 1 && (pendingQuery.data?.users.length ?? 0) <= 1) setPage((current) => Math.max(1, current - 1))
      await queryClient.invalidateQueries({ queryKey: ['admin-users', 'pending'] })
    },
  })

  const users = pendingQuery.data?.users ?? []
  const pagination = pendingQuery.data?.pagination

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
    setFeedback(null)
  }

  function openDecision(user: User, action: Decision['action']) {
    decisionMutation.reset()
    setDecision({ user, action })
    setReason('')
    setReasonError('')
    setFeedback(null)
  }

  function submitDecision() {
    if (!decision) return
    const trimmedReason = reason.trim()
    if (decision.action === 'reject' && trimmedReason.length > 0 && trimmedReason.length < 3) {
      setReasonError('Enter at least 3 characters or leave the reason blank.')
      return
    }
    if (trimmedReason.length > 1000) {
      setReasonError('The reason must be 1000 characters or fewer.')
      return
    }
    setReasonError('')
    decisionMutation.mutate({
      userId: decision.user.id,
      action: decision.action,
      reason: trimmedReason,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account approvals"
        description="Review new registrations and approve or reject pending accounts."
        status={pagination && <Badge tone={pagination.total ? 'warning' : 'success'}>{pagination.total} pending</Badge>}
        actions={
          <RefreshButton size="sm" onRefresh={() => void pendingQuery.refetch()} refreshing={pendingQuery.isFetching} />
        }
      />

      {feedback && <Notice tone={feedback.tone === 'success' ? 'success' : 'error'}>{feedback.message}</Notice>}

      <Card className="p-4 sm:p-5">
        <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search pending registrations</span>
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name or email"
              className="h-11 w-full rounded-lg border border-ink-100 bg-ink-50 pl-10 pr-3 text-sm text-ink-900 outline-none focus:border-brand-400"
            />
          </label>
          <Button type="submit"><Search size={16} /> Search</Button>
        </form>
      </Card>

      {pendingQuery.isLoading && (
        <Card className="grid min-h-56 place-items-center text-ink-500">
          <span className="flex items-center gap-2"><LoaderCircle className="animate-spin" size={20} /> Loading pending registrations…</span>
        </Card>
      )}

      {pendingQuery.isError && (
        <ErrorState
          title="Could not load registrations"
          message={apiMessage(pendingQuery.error)}
          action={<Button variant="secondary" onClick={() => void pendingQuery.refetch()}>Try again</Button>}
        />
      )}

      {pendingQuery.data && users.length === 0 && (
        <EmptyState
          title={search ? 'No matching registrations' : 'No pending registrations'}
          message={search ? 'Try another name or email address.' : 'New registrations awaiting review will appear here.'}
        />
      )}

      {pendingQuery.data && users.length > 0 && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {users.map((user) => (
              <Card key={user.id} className="p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-ink-900">{user.fullName}</h2>
                      <Badge tone="warning">Pending</Badge>
                    </div>
                    <p className="mt-1 break-all text-sm text-ink-500">{user.email}</p>
                    <p className="mt-1 text-sm text-ink-500">{user.phoneNumber || 'Phone not provided'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ink-950 px-3 py-2 text-xs font-semibold text-ink-600">
                    <UserRound size={15} /> {user.role}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-ink-500">
                  <Clock3 size={15} />
                  Registered {formatRegistrationDate(user.createdAt)}
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openDecision(user, 'reject')}
                    disabled={decisionMutation.isPending}
                  >
                    <X size={16} /> Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openDecision(user, 'approve')}
                    disabled={decisionMutation.isPending}
                  >
                    <Check size={16} /> Approve
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-500">
              Showing {(pagination!.page - 1) * pagination!.limit + 1}–{Math.min(pagination!.page * pagination!.limit, pagination!.total)} of {pagination!.total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || pendingQuery.isFetching}
              >
                <ChevronLeft size={16} /> Previous
              </Button>
              <span className="px-2 text-sm text-ink-500">Page {pagination!.page} of {Math.max(pagination!.totalPages, 1)}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
                disabled={pendingQuery.isFetching || page >= pagination!.totalPages}
              >
                Next <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={decision !== null}
        onClose={() => {
          if (decisionMutation.isPending) return
          setDecision(null)
          setReasonError('')
        }}
        title={decision?.action === 'approve' ? 'Approve account?' : 'Reject registration?'}
        description={decision ? `${decision.user.fullName} · ${decision.user.email}` : undefined}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDecision(null)}
              disabled={decisionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submitDecision}
              disabled={decisionMutation.isPending}
              className={decision?.action === 'reject' ? 'bg-danger-500 hover:bg-danger-600' : ''}
            >
              {decisionMutation.isPending && <LoaderCircle size={16} className="animate-spin" />}
              {decision?.action === 'approve' ? 'Approve account' : 'Reject registration'}
            </Button>
          </>
        }
      >
        {decision?.action === 'approve' ? (
          <p className="text-sm leading-6 text-ink-600">
            This will activate the account and notify the registrant. They will be able to sign in after approval.
          </p>
        ) : (
          <div>
            <label htmlFor="rejection-reason" className="mb-2 block text-sm font-semibold text-ink-700">
              Reason <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <textarea
              id="rejection-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setReasonError('')
              }}
              maxLength={1000}
              rows={4}
              placeholder="Add a note for the registration decision"
              className="w-full rounded-lg border border-ink-100 bg-ink-50 p-3 text-sm text-ink-900 outline-none focus:border-brand-400"
              disabled={decisionMutation.isPending}
            />
            <p className="mt-1 text-right text-xs text-ink-500">{reason.length}/1000</p>
            {reasonError && <p role="alert" className="mt-2 text-sm text-danger-500">{reasonError}</p>}
          </div>
        )}
        {decisionMutation.isError && <Notice className="mt-4">{apiMessage(decisionMutation.error)}</Notice>}
      </Modal>
    </div>
  )
}
