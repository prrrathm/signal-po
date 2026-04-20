import { db } from '@/db'
import { emails } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { Email } from '@/db/schema'

export async function storeEmail(
  data: {
    subject: string
    body: string
    supplierName?: string
    hasAttachments?: boolean
    messageId?: string | null
    fromEmail?: string | null
  },
  teamId: string
): Promise<Email> {
  const [email] = await db
    .insert(emails)
    .values({
      subject: data.subject,
      body: data.body,
      supplierName: data.supplierName ?? null,
      hasAttachments: data.hasAttachments ? 'true' : 'false',
      messageId: data.messageId ?? null,
      fromEmail: data.fromEmail ?? null,
      teamId,
    })
    .returning()
  return email
}

/**
 * Returns the existing email row if a message with this Message-ID has already
 * been ingested for the team, null otherwise.
 */
export async function findByMessageId(
  messageId: string,
  teamId: string
): Promise<Email | null> {
  const [email] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.messageId, messageId), eq(emails.teamId, teamId)))
  return email ?? null
}

export async function getEmailById(id: string, teamId: string): Promise<Email | null> {
  const [email] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.id, id), eq(emails.teamId, teamId)))
  return email ?? null
}

export async function listEmails(teamId: string): Promise<Email[]> {
  return db
    .select()
    .from(emails)
    .where(eq(emails.teamId, teamId))
    .orderBy(desc(emails.receivedAt))
}

export async function updateEmailStatus(
  id: string,
  status: 'pending' | 'processing' | 'processed' | 'failed'
): Promise<void> {
  await db.update(emails).set({ status }).where(eq(emails.id, id))
}
