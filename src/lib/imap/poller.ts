import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { db } from '@/db'
import { teamEmailIntegrations } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { ingest } from '@/lib/services/ingest.service'
import type { TeamEmailIntegration } from '@/db/schema'

const IMAP_PROVIDERS = ['gmail', 'outlook', 'yahoo', 'imap'] as const
const MAX_MESSAGES_PER_POLL = 50

export interface PollResult {
  integrationId: string
  fetched: number
  ingested: number
  duplicates: number
  error?: string
}

export async function pollIntegration(integration: TeamEmailIntegration): Promise<PollResult> {
  const result: PollResult = {
    integrationId: integration.id,
    fetched: 0,
    ingested: 0,
    duplicates: 0,
  }

  const credentials = integration.credentials as { password?: string } | null
  if (!credentials?.password || !integration.email || !integration.imapHost || !integration.imapPort) {
    result.error = 'Missing IMAP credentials or connection details'
    await db
      .update(teamEmailIntegrations)
      .set({ status: 'error', errorMessage: result.error })
      .where(eq(teamEmailIntegrations.id, integration.id))
    return result
  }

  const client = new ImapFlow({
    host: integration.imapHost,
    port: integration.imapPort,
    secure: true,
    auth: { user: integration.email, pass: credentials.password },
    logger: false,
  })

  try {
    await client.connect()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    result.error = message
    await db
      .update(teamEmailIntegrations)
      .set({ status: 'error', errorMessage: message })
      .where(eq(teamEmailIntegrations.id, integration.id))
    return result
  }

  const lock = await client.getMailboxLock('INBOX')
  try {
    const searchResult = await client.search({ seen: false }, { uid: true })
    const uids: number[] = searchResult === false ? [] : searchResult
    const limited = uids.slice(0, MAX_MESSAGES_PER_POLL)
    result.fetched = limited.length

    for (const uid of limited) {
      try {
        const msgOrFalse = await client.fetchOne(String(uid), { source: true }, { uid: true })
        if (!msgOrFalse) continue
        const source: Buffer | undefined = msgOrFalse.source
        if (!source) continue

        const parsed = await simpleParser(source)

        // mailparser sets html to false (not undefined) when no HTML body
        const htmlBody: string | undefined = parsed.html !== false ? parsed.html : undefined

        const inboundEmail = {
          messageId: parsed.messageId ?? null,
          from: parsed.from?.value[0]?.address ?? null,
          subject: parsed.subject ?? '(no subject)',
          body: parsed.text ?? htmlBody ?? '',
          attachments: (parsed.attachments ?? []).map((a) => ({
            filename: a.filename ?? 'attachment',
            buffer: a.content,
            contentType: a.contentType,
          })),
        }

        const ingestResult = await ingest(integration.teamId, inboundEmail)

        // Mark as read only after successful ingest
        await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })

        if (ingestResult.duplicate) {
          result.duplicates++
        } else {
          result.ingested++
        }
      } catch (msgErr) {
        // Non-fatal: log and continue with remaining messages
        console.error(`IMAP: failed to process message uid=${uid} for integration ${integration.id}:`, msgErr)
      }
    }

    // Clear any previous error state on success
    await db
      .update(teamEmailIntegrations)
      .set({ status: 'active', errorMessage: null })
      .where(eq(teamEmailIntegrations.id, integration.id))
  } finally {
    lock.release()
    await client.logout()
  }

  return result
}

export async function pollAllTeamIntegrations(teamId: string): Promise<PollResult[]> {
  const integrations = await db
    .select()
    .from(teamEmailIntegrations)
    .where(
      and(
        eq(teamEmailIntegrations.teamId, teamId),
        eq(teamEmailIntegrations.status, 'active'),
        inArray(teamEmailIntegrations.provider, [...IMAP_PROVIDERS])
      )
    )

  const results: PollResult[] = []
  for (const integration of integrations) {
    const result = await pollIntegration(integration)
    results.push(result)
  }
  return results
}
