import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { listTeamMembers, getTeamsForUser } from '@/lib/services/team.service'
import { listIntegrations } from '@/lib/services/integration.service'
import { TeamSettingsClient } from './team-settings-client'

export default async function TeamSettingsPage() {
  const session = await getSession()
  if (!session?.activeTeamId) {
    redirect('/login')
  }

  const teams = await getTeamsForUser(session.user.id)
  const activeTeam = teams.find((t) => t.id === session.activeTeamId)

  if (!activeTeam) {
    redirect('/dashboard')
  }

  const [members, integrations] = await Promise.all([
    listTeamMembers(session.user.id, session.activeTeamId),
    listIntegrations(session.user.id, session.activeTeamId),
  ])

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const baseUrl = `${protocol}://${host}`

  const secret = process.env.INBOUND_WEBHOOK_SECRET ?? ''
  const webhookUrl = `${baseUrl}/api/emails/inbound?teamId=${session.activeTeamId}&token=${secret}`

  // Strip credentials before passing to client
  const safeIntegrations = integrations.map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { credentials, ...rest } = row
    return rest
  })

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Team Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Manage your team and its members.</p>

      <TeamSettingsClient
        team={activeTeam}
        members={members}
        currentUserId={session.user.id}
        currentUserRole={activeTeam.role}
        integrations={safeIntegrations}
        webhookUrl={webhookUrl}
      />
    </div>
  )
}
