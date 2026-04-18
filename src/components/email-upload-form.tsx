'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

type ProcessingState = 'idle' | 'ingesting' | 'processing' | 'done' | 'error'

export function EmailUploadForm({ onSuccess }: { onSuccess?: () => void }) {
  const [subject, setSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [state, setState] = useState<ProcessingState>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !emailBody.trim()) return

    setState('ingesting')
    setMessage('')

    try {
      // Step 1: ingest
      const ingestRes = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, emailBody, supplierName: supplierName || undefined }),
      })

      if (!ingestRes.ok) {
        const err = await ingestRes.json()
        throw new Error(err.error ?? 'Failed to ingest email')
      }

      setState('processing')

      // Step 2: trigger worker
      const workerRes = await fetch('/api/worker', { method: 'POST' })
      const workerData = await workerRes.json()

      if (workerData.error) {
        setState('error')
        setMessage(`Processing failed: ${workerData.error}`)
      } else {
        setState('done')
        setMessage('Email ingested and processed successfully.')
        setSubject('')
        setEmailBody('')
        setSupplierName('')
        onSuccess?.()
      }
    } catch (err) {
      setState('error')
      setMessage(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const stateInfo: Record<ProcessingState, { label: string; color: string }> = {
    idle: { label: '', color: '' },
    ingesting: { label: 'Saving email...', color: 'bg-blue-100 text-blue-800' },
    processing: { label: 'Extracting with Claude...', color: 'bg-purple-100 text-purple-800' },
    done: { label: message, color: 'bg-green-100 text-green-800' },
    error: { label: message, color: 'bg-red-100 text-red-800' },
  }

  const info = stateInfo[state]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="supplier">Supplier Name (optional)</Label>
        <Input
          id="supplier"
          placeholder="e.g. Acme Components Ltd"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          disabled={state === 'ingesting' || state === 'processing'}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="subject">Email Subject</Label>
        <Input
          id="subject"
          placeholder="RE: PO-2024-001 Confirmation"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          disabled={state === 'ingesting' || state === 'processing'}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body">Email Body</Label>
        <Textarea
          id="body"
          placeholder="Paste the full supplier email here..."
          value={emailBody}
          onChange={(e) => setEmailBody(e.target.value)}
          required
          rows={10}
          disabled={state === 'ingesting' || state === 'processing'}
        />
      </div>

      {state !== 'idle' && info.label && (
        <div className={`px-3 py-2 rounded text-sm ${info.color}`}>{info.label}</div>
      )}

      <Button
        type="submit"
        disabled={state === 'ingesting' || state === 'processing' || !subject || !emailBody}
        className="w-full"
      >
        {state === 'ingesting'
          ? 'Saving...'
          : state === 'processing'
            ? 'Processing with Claude...'
            : 'Ingest & Process Email'}
      </Button>
    </form>
  )
}
