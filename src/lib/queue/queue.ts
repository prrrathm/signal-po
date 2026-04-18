import { db } from '@/db'
import { jobs } from '@/db/schema'

export async function enqueue(emailId: string): Promise<string> {
  const [job] = await db
    .insert(jobs)
    .values({ emailId, status: 'pending' })
    .returning()
  return job.id
}
