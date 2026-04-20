import type { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams } from '@/db/schema'
import { processNextJob } from '@/lib/queue/worker'
import { pollAllTeamIntegrations } from '@/lib/imap/poller'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  if (request.headers.get('x-cron-secret') !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allTeams = await db.select({ id: teams.id }).from(teams)

  const summary = []

  for (const team of allTeams) {
    const teamId = team.id
    let imapFetched = 0
    let imapErrors = 0
    let jobsProcessed = 0
    let jobErrors = 0

    // 1. Poll IMAP integrations first so new emails are enqueued before the job drain
    try {
      const pollResults = await pollAllTeamIntegrations(teamId)
      for (const r of pollResults) {
        imapFetched += r.fetched
        if (r.error) imapErrors++
      }
    } catch (err) {
      console.error(`IMAP poll failed for team ${teamId}:`, err)
      imapErrors++
    }

    // 2. Drain all pending jobs for this team
    while (true) {
      const result = await processNextJob(teamId)
      if (!result.processed) break
      if (result.error) {
        jobErrors++
      } else {
        jobsProcessed++
      }
    }

    summary.push({ teamId, imapFetched, imapErrors, jobsProcessed, jobErrors })
  }

  return Response.json({ ok: true, summary })
}
