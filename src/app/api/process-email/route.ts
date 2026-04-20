import { getSession } from '@/lib/auth/session'
import { getTeamsForUser } from '@/lib/services/team.service'
import { processNextJob } from '@/lib/queue/worker'

export const maxDuration = 120 // seconds

export async function POST() {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let teamId = session.activeTeamId
  if (!teamId) {
    const teams = await getTeamsForUser(session.user.id)
    if (!teams.length) {
      return Response.json({ error: 'No team found for user' }, { status: 400 })
    }
    teamId = teams[0].id
  }

  const result = await processNextJob(teamId)
  return Response.json(result)
}
