import type { NextRequest } from 'next/server'
import { getEmailById } from '@/lib/services/email.service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const email = await getEmailById(id)
  if (!email) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(email)
}
