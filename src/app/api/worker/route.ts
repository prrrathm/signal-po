import { processNextJob } from '@/lib/queue/worker'

export async function POST() {
  const result = await processNextJob()
  return Response.json(result)
}
