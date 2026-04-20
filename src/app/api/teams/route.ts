import { getSession } from '@/lib/auth/session'
import { getTeamsForUser } from '@/lib/services/team.service'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teams = await getTeamsForUser(session.user.id)
  return Response.json(teams)
}
