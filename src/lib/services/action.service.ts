import { db } from '@/db'
import { parsedConfirmations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logAudit } from './audit.service'

export async function approveConfirmation(id: string): Promise<void> {
  await db
    .update(parsedConfirmations)
    .set({ status: 'matched', resolvedAt: new Date() })
    .where(eq(parsedConfirmations.id, id))
  await logAudit('confirmation', id, 'approved')
}

export async function snoozeConfirmation(id: string, hours = 24): Promise<void> {
  const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000)
  await db
    .update(parsedConfirmations)
    .set({ snoozedUntil })
    .where(eq(parsedConfirmations.id, id))
  await logAudit('confirmation', id, 'snoozed', { hours, snoozedUntil: snoozedUntil.toISOString() })
}

export async function resolveConfirmation(id: string): Promise<void> {
  await db
    .update(parsedConfirmations)
    .set({ resolvedAt: new Date() })
    .where(eq(parsedConfirmations.id, id))
  await logAudit('confirmation', id, 'resolved')
}
