import { Badge } from '@/components/ui/badge'

interface Mismatch {
  type: string
  severity: string
  description: string
}

const TYPE_LABELS: Record<string, string> = {
  quantity: 'Qty',
  date: 'Date',
  price: 'Price',
  unmatched: 'No PO',
}

const SEVERITY_CLASS: Record<string, string> = {
  high: 'bg-red-100 text-red-800 hover:bg-red-100',
  medium: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  low: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
}

export function MismatchBadge({ mismatch }: { mismatch: Mismatch }) {
  const label = TYPE_LABELS[mismatch.type] ?? mismatch.type
  const cls = SEVERITY_CLASS[mismatch.severity] ?? ''
  return (
    <Badge variant="secondary" className={cls} title={mismatch.description}>
      {label}
    </Badge>
  )
}

export function MismatchList({ mismatches }: { mismatches: Mismatch[] }) {
  if (!mismatches.length) return <span className="text-gray-400 text-sm">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {mismatches.map((m, i) => (
        <MismatchBadge key={i} mismatch={m} />
      ))}
    </div>
  )
}
