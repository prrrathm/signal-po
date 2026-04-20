import { NextRequest } from 'next/server'
import { storeEmail, listEmails } from '@/lib/services/email.service'
import { enqueue } from '@/lib/queue/queue'
import { getSession } from '@/lib/auth/session'
import { db } from '@/db'
import { attachments, emails } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { saveFile } from '@/lib/services/storage.service'
import { detectMimeType, UnsupportedFileTypeError } from '@/lib/attachments/detect'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 5

export async function GET() {
  const session = await getSession()
  if (!session?.activeTeamId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const emailList = await listEmails(session.activeTeamId)
  return Response.json(emailList)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.activeTeamId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contentType = request.headers.get('content-type') ?? ''

  let subject: string
  let emailBody: string
  let supplierName: string | undefined
  let files: File[] = []

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    subject = (formData.get('subject') as string | null) ?? ''
    emailBody = (formData.get('emailBody') as string | null) ?? ''
    supplierName = (formData.get('supplierName') as string | null) ?? undefined
    files = formData.getAll('attachments').filter((v): v is File => v instanceof File)
  } else {
    const body = await request.json() as {
      subject?: string
      emailBody?: string
      supplierName?: string
      messageId?: string
      fromEmail?: string
    }
    subject = body.subject ?? ''
    emailBody = body.emailBody ?? ''
    supplierName = body.supplierName
  }

  if (!subject || !emailBody) {
    return Response.json({ error: 'subject and emailBody are required' }, { status: 400 })
  }

  if (files.length > MAX_FILES) {
    return Response.json({ error: `Maximum ${MAX_FILES} attachments allowed` }, { status: 400 })
  }

  // Validate files before storing anything
  const fileBuffers: { file: File; buffer: Buffer; mimeType: string }[] = []
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: `File "${file.name}" exceeds the 10 MB size limit` },
        { status: 413 }
      )
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    try {
      const mimeType = detectMimeType(buffer, file.name, file.type)
      fileBuffers.push({ file, buffer, mimeType })
    } catch (err) {
      if (err instanceof UnsupportedFileTypeError) {
        return Response.json({ error: err.message }, { status: 400 })
      }
      throw err
    }
  }

  const email = await storeEmail(
    { subject, body: emailBody, supplierName, hasAttachments: fileBuffers.length > 0 },
    session.activeTeamId
  )

  // Persist attachments to storage + DB
  for (const { file, buffer, mimeType } of fileBuffers) {
    const ext = path.extname(file.name)
    const safeName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9._-]/g, '_') + ext
    const storageKey = `${session.activeTeamId}/${email.id}/${randomUUID()}-${safeName}`

    await saveFile(storageKey, buffer)

    await db.insert(attachments).values({
      emailId: email.id,
      filename: file.name,
      mimeType,
      storageKey,
      fileSizeBytes: file.size,
      status: 'pending',
    })
  }

  if (fileBuffers.length > 0) {
    await db
      .update(emails)
      .set({ hasAttachments: 'true' })
      .where(eq(emails.id, email.id))
  }

  const jobId = await enqueue(email.id)

  return Response.json(
    { email, jobId, attachmentCount: fileBuffers.length },
    { status: 201 }
  )
}
