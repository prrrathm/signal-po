import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { updateTeamName, deleteTeam, ForbiddenError } from '@/lib/services/team.service'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { teamId } = await params
  const body = await request.json()
  const { name } = body as { name?: string }
  if (!name?.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 })
  }

  try {
    const team = await updateTeamName(session.user.id, teamId, name.trim())
    return Response.json(team)
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return Response.json({ error: err.message }, { status: 403 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { teamId } = await params

  try {
    await deleteTeam(session.user.id, teamId)
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return Response.json({ error: err.message }, { status: 403 })
    }
    throw err
  }
}
