import type { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { approveConfirmation, snoozeConfirmation, resolveConfirmation } from '@/lib/services/action.service'
import { getSession } from '@/lib/auth/session'
import { ForbiddenError } from '@/lib/services/team.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.activeTeamId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { action } = body as { action: 'approve' | 'snooze' | 'resolve' }
  const teamId = session.activeTeamId

  try {
    switch (action) {
      case 'approve':
        await approveConfirmation(id, teamId)
        break
      case 'snooze':
        await snoozeConfirmation(id, teamId)
        break
      case 'resolve':
        await resolveConfirmation(id, teamId)
        break
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return Response.json({ error: err.message }, { status: 403 })
    }
    throw err
  }

  revalidateTag(`confirmations:${teamId}`, {})
  return Response.json({ ok: true })
}
