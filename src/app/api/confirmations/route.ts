import { listConfirmations } from '@/lib/services/confirmation.service'

export async function GET() {
  try {
    const confirmations = await listConfirmations()
    return Response.json(confirmations)
  } catch (err) {
    console.error('[GET /api/confirmations]', err)
    return Response.json({ error: 'Failed to load confirmations' }, { status: 500 })
  }
}
