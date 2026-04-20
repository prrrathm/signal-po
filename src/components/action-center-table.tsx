'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/status-badge'
import { MismatchList } from '@/components/mismatch-badge'
import type { ConfirmationWithDetails } from '@/lib/types'

type FilterStatus = 'all' | 'needs_review' | 'high_priority_flag' | 'matched' | 'unmatched'

const columnHelper = createColumnHelper<ConfirmationWithDetails>()

const columns = [
  columnHelper.accessor('poNumber', {
    header: 'PO Number',
    cell: (info) => (
      <span className="font-mono font-medium">{info.getValue() ?? '—'}</span>
    ),
  }),
  columnHelper.accessor('supplierName', {
    header: 'Supplier',
    cell: (info) => info.getValue() ?? <span className="text-gray-400">Unknown</span>,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor('mismatches', {
    header: 'Flags',
    cell: (info) => <MismatchList mismatches={info.getValue()} />,
  }),
  columnHelper.accessor('confidence', {
    header: 'Confidence',
    cell: (info) => {
      const val = info.getValue()
      const pct = Math.round(val * 100)
      const color = pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-yellow-700' : 'text-red-700'
      return <span className={`font-medium ${color}`}>{pct}%</span>
    },
  }),
  columnHelper.accessor('confirmedQty', {
    header: 'Conf. Qty',
    cell: (info) => info.getValue() ?? '—',
  }),
  columnHelper.accessor('confirmedDeliveryDate', {
    header: 'Delivery',
    cell: (info) => info.getValue() ?? '—',
  }),
  columnHelper.accessor('email', {
    header: 'Subject',
    cell: (info) => (
      <span className="text-sm text-gray-600 truncate max-w-[200px] block" title={info.getValue().subject}>
        {info.getValue().subject}
      </span>
    ),
  }),
]

export function ActionCenterTable() {
  const [data, setData] = useState<ConfirmationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/confirmations')
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error('Failed to fetch confirmations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const filtered = useMemo(
    () => filter === 'all' ? data : data.filter((d) => d.status === filter),
    [data, filter]
  )

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  async function handleAction(id: string, action: 'approve' | 'snooze' | 'resolve') {
    setActionLoading(id + action)
    try {
      await fetch(`/api/confirmations/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const filters: { label: string; value: FilterStatus }[] = [
    { label: 'All', value: 'all' },
    { label: 'High Priority', value: 'high_priority_flag' },
    { label: 'Needs Review', value: 'needs_review' },
    { label: 'Matched', value: 'matched' },
    { label: 'Unmatched', value: 'unmatched' },
  ]

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterStatus)} className="flex-1">
          <TabsList>
            {filters.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="gap-1.5">
                {f.label}
                {f.value !== 'all' && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                    {data.filter((d) => d.status === f.value).length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          ↻ Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
                <TableHead>Actions</TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-8 text-gray-400">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-8 text-gray-400">
                  No confirmations yet. Ingest some emails to get started.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex gap-1">
                      {row.original.resolvedAt ? (
                        <span className="text-xs text-gray-400">Resolved</span>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!actionLoading}
                            onClick={() => handleAction(row.original.id, 'approve')}
                            className="text-green-700 border-green-300 hover:bg-green-50 h-7 text-xs"
                          >
                            {actionLoading === row.original.id + 'approve' ? '...' : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!actionLoading}
                            onClick={() => handleAction(row.original.id, 'snooze')}
                            className="h-7 text-xs"
                          >
                            {actionLoading === row.original.id + 'snooze' ? '...' : 'Snooze'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!actionLoading}
                            onClick={() => handleAction(row.original.id, 'resolve')}
                            className="h-7 text-xs"
                          >
                            {actionLoading === row.original.id + 'resolve' ? '...' : 'Resolve'}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">Auto-refreshes every 30 seconds.</p>
    </div>
  )
}
