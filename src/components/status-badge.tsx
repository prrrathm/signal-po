import { Badge } from '@/components/ui/badge'

type Status = 'matched' | 'needs_review' | 'high_priority_flag' | 'unmatched'

const CONFIG: Record<Status, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  matched: {
    label: 'Matched',
    variant: 'default',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  needs_review: {
    label: 'Needs Review',
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  },
  high_priority_flag: {
    label: 'High Priority',
    variant: 'destructive',
    className: '',
  },
  unmatched: {
    label: 'Unmatched',
    variant: 'outline',
    className: 'border-gray-400 text-gray-600',
  },
}

export function StatusBadge({ status }: { status: Status }) {
  const cfg = CONFIG[status] ?? CONFIG.unmatched
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {cfg.label}
    </Badge>
  )
}
