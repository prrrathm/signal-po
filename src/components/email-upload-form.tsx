'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

type ProcessingState = 'idle' | 'ingesting' | 'processing' | 'done' | 'error'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 5
const ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png,.webp'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function EmailUploadForm({ onSuccess }: { onSuccess?: () => void }) {
  const [subject, setSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [state, setState] = useState<ProcessingState>('idle')
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const busy = state === 'ingesting' || state === 'processing'

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    const combined = [...attachedFiles, ...selected]

    if (combined.length > MAX_FILES) {
      setMessage(`Maximum ${MAX_FILES} attachments allowed`)
      setState('error')
      return
    }

    const oversized = combined.find((f) => f.size > MAX_FILE_SIZE)
    if (oversized) {
      setMessage(`"${oversized.name}" exceeds the 10 MB size limit`)
      setState('error')
      return
    }

    setAttachedFiles(combined)
    if (state === 'error') setState('idle')
    // Reset the input so the same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !emailBody.trim()) return

    setState('ingesting')
    setMessage('')

    try {
      const fd = new FormData()
      fd.append('subject', subject)
      fd.append('emailBody', emailBody)
      if (supplierName) fd.append('supplierName', supplierName)
      for (const file of attachedFiles) fd.append('attachments', file)

      // Step 1: ingest (no Content-Type header — browser sets multipart boundary)
      const ingestRes = await fetch('/api/emails', { method: 'POST', body: fd })

      if (!ingestRes.ok) {
        const err = await ingestRes.json()
        throw new Error(err.error ?? 'Failed to ingest email')
      }

      const ingestData = await ingestRes.json() as { attachmentCount?: number }

      setState('processing')

      // Step 2: trigger processing (session-authenticated, team-scoped)
      const workerRes = await fetch('/api/process-email', { method: 'POST' })
      const workerData = await workerRes.json()

      if (workerData.error) {
        setState('error')
        setMessage(`Processing failed: ${workerData.error}`)
      } else {
        const attNote =
          ingestData.attachmentCount && ingestData.attachmentCount > 0
            ? ` (${ingestData.attachmentCount} attachment${ingestData.attachmentCount > 1 ? 's' : ''} extracted)`
            : ''
        setState('done')
        setMessage(`Email ingested and processed successfully.${attNote}`)
        setSubject('')
        setEmailBody('')
        setSupplierName('')
        setAttachedFiles([])
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
    processing: { label: 'Extracting with AI...', color: 'bg-purple-100 text-purple-800' },
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
          disabled={busy}
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
          disabled={busy}
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
          rows={8}
          disabled={busy}
        />
      </div>

      {/* Attachment upload */}
      <div className="grid gap-2">
        <Label>Attachments (optional)</Label>
        <div
          className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
          onClick={() => !busy && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleFileChange}
            disabled={busy}
          />
          <p className="text-sm text-gray-500">
            Click to attach files <span className="text-xs">(PDF, Excel, CSV, image — max 10 MB each)</span>
          </p>
        </div>

        {attachedFiles.length > 0 && (
          <ul className="space-y-1">
            {attachedFiles.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5 border"
              >
                <span className="truncate flex-1 min-w-0 mr-2">{file.name}</span>
                <span className="text-gray-400 text-xs shrink-0 mr-2">{formatBytes(file.size)}</span>
                {!busy && (
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-gray-400 hover:text-red-500 shrink-0"
                    aria-label={`Remove ${file.name}`}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {attachedFiles.length > 0 && (
          <p className="text-xs text-gray-400">
            {attachedFiles.length} / {MAX_FILES} files
          </p>
        )}
      </div>

      {state !== 'idle' && info.label && (
        <div className={`px-3 py-2 rounded text-sm ${info.color}`}>{info.label}</div>
      )}

      <Button
        type="submit"
        disabled={busy || !subject || !emailBody}
        className="w-full"
      >
        {state === 'ingesting'
          ? 'Saving...'
          : state === 'processing'
            ? 'Processing...'
            : 'Ingest & Process Email'}
      </Button>
    </form>
  )
}
