import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { changeMemberRole, removeMember, ForbiddenError } from '@/lib/services/team.service'
import type { TeamRole } from '@/db/schema'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; userId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { teamId, userId } = await params
  const body = await request.json()
  const { role } = body as { role?: TeamRole }

  if (!role) {
    return Response.json({ error: 'role is required' }, { status: 400 })
  }

  try {
    await changeMemberRole(session.user.id, teamId, userId, role)
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return Response.json({ error: err.message }, { status: 403 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string; userId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { teamId, userId } = await params

  try {
    await removeMember(session.user.id, teamId, userId)
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return Response.json({ error: err.message }, { status: 403 })
    }
    throw err
  }
}
