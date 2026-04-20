import type { NextRequest } from 'next/server'
import { getSession, setActiveTeam } from '@/lib/auth/session'
import { assertTeamMember } from '@/lib/services/team.service'
import { ForbiddenError } from '@/lib/services/team.service'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { teamId } = body as { teamId?: string }
  if (!teamId) {
    return Response.json({ error: 'teamId is required' }, { status: 400 })
  }

  try {
    await assertTeamMember(session.user.id, teamId)
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return Response.json({ error: err.message }, { status: 403 })
    }
    throw err
  }

  await setActiveTeam(teamId)
  return Response.json({ ok: true })
}
