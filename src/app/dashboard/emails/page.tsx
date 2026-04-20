'use client'

import { useState, useEffect, useCallback } from 'react'
import { EmailUploadForm } from '@/components/email-upload-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Email {
  id: string
  subject: string
  supplierName: string | null
  status: 'pending' | 'processing' | 'processed' | 'failed'
  receivedAt: string
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  processing: 'bg-blue-100 text-blue-700',
  processed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/emails')
      if (res.ok) setEmails(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  async function handleSeed() {
    setSeeding(true)
    setSeedMsg('')
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      setSeedMsg(`Seeded ${data.purchaseOrders} POs and ${data.emails} emails.`)
      await fetchEmails()
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ingest Email</h2>
        <p className="text-gray-500 text-sm mt-1">
          Paste a supplier confirmation email to extract PO data and check for mismatches.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paste Email</CardTitle>
            <CardDescription>
              Paste the subject and body of a supplier confirmation email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailUploadForm onSuccess={fetchEmails} />
          </CardContent>
        </Card>

        {/* Recent emails */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Emails</CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchEmails}>
                  ↻
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : emails.length === 0 ? (
                <p className="text-sm text-gray-400">No emails yet.</p>
              ) : (
                <div className="space-y-2">
                  {emails.map((email) => (
                    <div
                      key={email.id}
                      className="flex items-start justify-between p-2 rounded border bg-gray-50 gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{email.subject}</p>
                        <p className="text-xs text-gray-500">
                          {email.supplierName ?? 'Unknown supplier'} ·{' '}
                          {new Date(email.receivedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${STATUS_STYLE[email.status] ?? ''} shrink-0 capitalize text-xs`}
                      >
                        {email.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seed helper */}
          <Card className="border-dashed bg-gray-50">
            <CardContent className="pt-5 space-y-3">
              <p className="text-sm text-gray-600">
                <strong>No emails?</strong> Load mock data to try the system immediately.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeed}
                disabled={seeding}
                className="w-full"
              >
                {seeding ? 'Seeding...' : '🌱 Seed Mock Data'}
              </Button>
              {seedMsg && (
                <p className="text-xs text-green-700">{seedMsg}</p>
              )}
              <p className="text-xs text-gray-400">
                Adds 3 purchase orders and 5 supplier emails with various scenarios
                (matched, quantity short, delayed, price deviation, unmatched PO).
                After seeding, use the Ingest Email form to trigger processing.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
