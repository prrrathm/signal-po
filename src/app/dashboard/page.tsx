import { ActionCenterTable } from '@/components/action-center-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ActionCenterPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Action Center</h2>
        <p className="text-gray-500 text-sm mt-1">
          Review and triage supplier email confirmations against your purchase orders.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">PO Confirmations</CardTitle>
          <CardDescription>
            Flagged items require attention. Click Approve, Snooze, or Resolve to act.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionCenterTable />
        </CardContent>
      </Card>

      <Card className="bg-gray-50 border-dashed">
        <CardContent className="pt-5">
          <p className="text-sm text-gray-500">
            <strong>Quick start:</strong> Call{' '}
            <code className="bg-white border rounded px-1 py-0.5 text-xs">POST /api/seed</code>{' '}
            to load mock purchase orders and emails, then visit{' '}
            <a href="/dashboard/emails" className="underline text-blue-600">Ingest Email</a>{' '}
            to process them.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
