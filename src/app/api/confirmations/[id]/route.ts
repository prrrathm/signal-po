import type { NextRequest } from 'next/server'
import { getConfirmationById } from '@/lib/services/confirmation.service'
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
  const confirmation = await getConfirmationById(id, session.activeTeamId)
  if (!confirmation) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(confirmation)
}
