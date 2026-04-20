import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { listTeamMembers, inviteMember, ForbiddenError } from '@/lib/services/team.service'
import type { TeamRole } from '@/db/schema'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { teamId } = await params

  try {
    const members = await listTeamMembers(session.user.id, teamId)
    return Response.json(members)
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return Response.json({ error: err.message }, { status: 403 })
    }
    throw err
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { teamId } = await params
  const body = await request.json()
  const { email, role } = body as { email?: string; role?: TeamRole }

  if (!email) {
    return Response.json({ error: 'email is required' }, { status: 400 })
  }

  try {
    const member = await inviteMember(
      session.user.id,
      teamId,
      email,
      role ?? 'member'
    )
    return Response.json(member, { status: 201 })
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return Response.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof Error) {
      return Response.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}
