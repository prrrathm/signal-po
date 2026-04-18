import { db } from '@/db'
import { emails } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { Email } from '@/db/schema'

export async function storeEmail(data: {
  subject: string
  body: string
  supplierName?: string
}): Promise<Email> {
  const [email] = await db
    .insert(emails)
    .values({
      subject: data.subject,
      body: data.body,
      supplierName: data.supplierName ?? null,
    })
    .returning()
  return email
}

export async function getEmailById(id: string): Promise<Email | null> {
  const [email] = await db.select().from(emails).where(eq(emails.id, id))
  return email ?? null
}

export async function listEmails(): Promise<Email[]> {
  return db.select().from(emails).orderBy(desc(emails.receivedAt))
}

export async function updateEmailStatus(
  id: string,
  status: 'pending' | 'processing' | 'processed' | 'failed'
): Promise<void> {
  await db.update(emails).set({ status }).where(eq(emails.id, id))
}
