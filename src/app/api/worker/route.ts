import type { NextRequest } from 'next/server'
import { processNextJob } from '@/lib/queue/worker'

export const maxDuration = 120 // seconds

export async function POST(request: NextRequest) {
  const workerSecret = process.env.WORKER_SECRET
  if (!workerSecret) {
    return Response.json({ error: 'WORKER_SECRET not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${workerSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { teamId } = body as { teamId?: string }
  if (!teamId) {
    return Response.json({ error: 'teamId is required' }, { status: 400 })
  }

  const result = await processNextJob(teamId)
  return Response.json(result)
}
