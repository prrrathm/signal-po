import type { NextRequest } from 'next/server'
import { getConfirmationById } from '@/lib/services/confirmation.service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const confirmation = await getConfirmationById(id)
  if (!confirmation) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(confirmation)
}
