import type { NextRequest } from 'next/server'
import { approveConfirmation, snoozeConfirmation, resolveConfirmation } from '@/lib/services/action.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { action } = body as { action: 'approve' | 'snooze' | 'resolve' }

  switch (action) {
    case 'approve':
      await approveConfirmation(id)
      break
    case 'snooze':
      await snoozeConfirmation(id)
      break
    case 'resolve':
      await resolveConfirmation(id)
      break
    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  return Response.json({ ok: true })
}
