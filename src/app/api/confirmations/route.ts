import { listConfirmations } from '@/lib/services/confirmation.service'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  if (!session?.activeTeamId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const confirmations = await listConfirmations(session.activeTeamId)
    return Response.json(confirmations)
  } catch (err) {
    console.error('[GET /api/confirmations]', err)
    return Response.json({ error: 'Failed to load confirmations' }, { status: 500 })
  }
}
