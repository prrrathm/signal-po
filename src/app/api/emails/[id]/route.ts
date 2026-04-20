import type { NextRequest } from 'next/server'
import { getEmailById } from '@/lib/services/email.service'
import { getSession } from '@/lib/auth/session'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.activeTeamId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const email = await getEmailById(id, session.activeTeamId)
  if (!email) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(email)
}
