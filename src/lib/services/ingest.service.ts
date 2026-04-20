import { db } from '@/db'
import { attachments, emails } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { storeEmail, findByMessageId } from '@/lib/services/email.service'
import { enqueue } from '@/lib/queue/queue'
import { saveFile } from '@/lib/services/storage.service'
import { detectMimeType, UnsupportedFileTypeError } from '@/lib/attachments/detect'
import { stripQuotedReplies } from '@/lib/email/strip-quoted'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 5

export interface ParsedAttachment {
  filename: string
  buffer: Buffer
  contentType: string
}

export interface InboundEmail {
  messageId: string | null
  from: string | null
  subject: string
  body: string
  attachments: ParsedAttachment[]
}

export interface IngestResult {
  duplicate: boolean
  emailId: string
  jobId?: string
  attachmentCount?: number
}

export async function ingest(teamId: string, parsed: InboundEmail): Promise<IngestResult> {
  // 1. Deduplication
  if (parsed.messageId) {
    const existing = await findByMessageId(parsed.messageId, teamId)
    if (existing) {
      return { duplicate: true, emailId: existing.id }
    }
  }

  // 2. Strip quoted replies
  const cleanBody = stripQuotedReplies(parsed.body)

  // 3. Validate + buffer attachment files
  const fileBuffers: { filename: string; buffer: Buffer; mimeType: string }[] = []
  for (const att of parsed.attachments) {
    if (att.buffer.length > MAX_FILE_SIZE) continue
    try {
      const mimeType = detectMimeType(att.buffer, att.filename, att.contentType)
      fileBuffers.push({ filename: att.filename, buffer: att.buffer, mimeType })
    } catch (err) {
      if (err instanceof UnsupportedFileTypeError) {
        console.warn(`Skipping unsupported attachment: ${att.filename}`)
        continue
      }
      throw err
    }
    if (fileBuffers.length >= MAX_FILES) break
  }

  // 4. Store email
  const email = await storeEmail(
    {
      subject: parsed.subject,
      body: cleanBody,
      fromEmail: parsed.from,
      messageId: parsed.messageId,
      hasAttachments: fileBuffers.length > 0,
    },
    teamId
  )

  // 5. Store attachments
  for (const { filename, buffer, mimeType } of fileBuffers) {
    const ext = path.extname(filename)
    const safeName = path.basename(filename, ext).replace(/[^a-zA-Z0-9._-]/g, '_') + ext
    const storageKey = `${teamId}/${email.id}/${randomUUID()}-${safeName}`

    await saveFile(storageKey, buffer)
    await db.insert(attachments).values({
      emailId: email.id,
      filename,
      mimeType,
      storageKey,
      fileSizeBytes: buffer.length,
      status: 'pending',
    })
  }

  if (fileBuffers.length > 0) {
    await db.update(emails).set({ hasAttachments: 'true' }).where(eq(emails.id, email.id))
  }

  // 6. Enqueue
  const jobId = await enqueue(email.id)

  return { duplicate: false, emailId: email.id, jobId, attachmentCount: fileBuffers.length }
}
