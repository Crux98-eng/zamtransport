import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function RefreshButton({
  onRefresh,
  refreshing,
  size = 'md',
  className,
}: {
  onRefresh: () => void
  refreshing: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      className={className}
      onClick={onRefresh}
      disabled={refreshing}
      aria-live="polite"
      aria-label={refreshing ? 'Refreshing data' : 'Refresh data'}
      title={refreshing ? 'Refreshing data' : 'Refresh data'}
    >
      <RefreshCw size={16} className={refreshing ? 'animate-spin text-brand-400' : ''} />
      <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
    </Button>
  )
}
