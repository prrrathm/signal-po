import { NextRequest } from 'next/server'
import { storeEmail, listEmails } from '@/lib/services/email.service'
import { enqueue } from '@/lib/queue/queue'

export async function GET() {
  const emails = await listEmails()
  return Response.json(emails)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { subject, emailBody, supplierName } = body as {
    subject: string
    emailBody: string
    supplierName?: string
  }

  if (!subject || !emailBody) {
    return Response.json({ error: 'subject and emailBody are required' }, { status: 400 })
  }

  const email = await storeEmail({ subject, body: emailBody, supplierName })
  const jobId = await enqueue(email.id)

  return Response.json({ email, jobId }, { status: 201 })
}
