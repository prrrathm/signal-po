/**
 * Inbound email webhook — accepts POST from SendGrid Inbound Parse or Postmark.
 *
 * Webhook URL pattern:
 *   POST /api/emails/inbound?teamId=<team-uuid>&token=<INBOUND_WEBHOOK_SECRET>
 *
 * Set INBOUND_WEBHOOK_SECRET in .env to a long random string.
 * Give each team their own URL (same secret, different teamId).
 *
 * SendGrid: set the endpoint in Inbound Parse settings; no extra config needed.
 * Postmark: set as the inbound webhook URL in Postmark stream settings.
 */

import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ingest, type InboundEmail, type ParsedAttachment } from '@/lib/services/ingest.service'

export const maxDuration = 60

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 5

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authorize(request: NextRequest): { teamId: string } | null {
  const secret = process.env.INBOUND_WEBHOOK_SECRET
  if (!secret) {
    console.error('INBOUND_WEBHOOK_SECRET is not set — rejecting inbound webhook')
    return null
  }
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const teamId = searchParams.get('teamId')
  if (!token || token !== secret || !teamId) return null
  return { teamId }
}

// ─── SendGrid parser ───────────────────────────────────────────────────────────

/**
 * SendGrid Inbound Parse sends multipart/form-data with fields:
 *   from, to, subject, text, html, headers (raw string), envelope (JSON),
 *   attachment1..N, attachment-info (JSON)
 */
async function parseSendGrid(formData: FormData): Promise<InboundEmail> {
  const subject = (formData.get('subject') as string | null) ?? '(no subject)'
  const body = (formData.get('text') as string | null) ?? (formData.get('html') as string | null) ?? ''
  const from = (formData.get('from') as string | null)

  // Extract Message-ID from raw headers string
  const rawHeaders = (formData.get('headers') as string | null) ?? ''
  const messageIdMatch = /^Message-ID:\s*(.+)$/im.exec(rawHeaders)
  const messageId = messageIdMatch ? messageIdMatch[1].trim() : null

  // attachment-info tells us filenames / content-types per slot
  const attInfoRaw = (formData.get('attachment-info') as string | null) ?? '{}'
  let attInfo: Record<string, { filename?: string; type?: string }> = {}
  try { attInfo = JSON.parse(attInfoRaw) } catch { /* ignore */ }

  const parsed: ParsedAttachment[] = []
  for (let i = 1; i <= MAX_FILES; i++) {
    const key = `attachment${i}`
    const file = formData.get(key)
    if (!(file instanceof File)) break
    if (file.size > MAX_FILE_SIZE) continue

    const meta = attInfo[key] ?? {}
    const filename = meta.filename ?? file.name ?? `attachment${i}`
    const buffer = Buffer.from(await file.arrayBuffer())
    parsed.push({ filename, buffer, contentType: meta.type ?? file.type })
  }

  return { messageId, from, subject, body, attachments: parsed }
}

// ─── Postmark parser ───────────────────────────────────────────────────────────

interface PostmarkPayload {
  From?: string
  Subject?: string
  TextBody?: string
  HtmlBody?: string
  MessageID?: string
  Attachments?: Array<{
    Name: string
    Content: string        // base64
    ContentType: string
    ContentLength: number
  }>
}

async function parsePostmark(body: string): Promise<InboundEmail> {
  const payload = JSON.parse(body) as PostmarkPayload
  const subject = payload.Subject ?? '(no subject)'
  const emailBody = payload.TextBody ?? payload.HtmlBody ?? ''
  const from = payload.From ?? null
  const messageId = payload.MessageID ?? null

  const parsed: ParsedAttachment[] = []
  for (const att of payload.Attachments ?? []) {
    if (att.ContentLength > MAX_FILE_SIZE) continue
    if (parsed.length >= MAX_FILES) break
    const buffer = Buffer.from(att.Content, 'base64')
    parsed.push({ filename: att.Name, buffer, contentType: att.ContentType })
  }

  return { messageId, from, subject, body: emailBody, attachments: parsed }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = authorize(request)
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify team exists
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, auth.teamId))
  if (!team) {
    return Response.json({ error: 'Team not found' }, { status: 404 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  let parsed: InboundEmail

  try {
    if (contentType.includes('multipart/form-data')) {
      // SendGrid Inbound Parse
      const formData = await request.formData()
      parsed = await parseSendGrid(formData)
    } else if (contentType.includes('application/json')) {
      // Postmark
      const body = await request.text()
      parsed = await parsePostmark(body)
    } else {
      return Response.json({ error: `Unsupported Content-Type: ${contentType}` }, { status: 415 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Failed to parse payload: ${message}` }, { status: 400 })
  }

  if (!parsed.subject && !parsed.body) {
    return Response.json({ error: 'Email has no subject or body' }, { status: 400 })
  }

  try {
    const result = await ingest(auth.teamId, parsed)
    if (result.duplicate) {
      return Response.json({ duplicate: true, emailId: result.emailId }, { status: 200 })
    }
    return Response.json(result, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Inbound webhook ingestion failed:', message)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
