import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { removeIntegration } from '@/lib/services/integration.service'
import { ForbiddenError } from '@/lib/services/team.service'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string; id: string }> }
) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId, id } = await params

  try {
    await removeIntegration(session.user.id, teamId, id)
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof ForbiddenError) return Response.json({ error: err.message }, { status: 403 })
    throw err
  }
}
