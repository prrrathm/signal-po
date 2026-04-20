import { db } from '@/db'
import { parsedConfirmations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logAudit } from './audit.service'
import { getConfirmationById } from './confirmation.service'
import { ForbiddenError } from './team.service'

async function assertOwnership(id: string, teamId: string) {
  const confirmation = await getConfirmationById(id, teamId)
  if (!confirmation) throw new ForbiddenError('Confirmation not found or access denied')
  return confirmation
}

export async function approveConfirmation(id: string, teamId: string): Promise<void> {
  await assertOwnership(id, teamId)
  await db
    .update(parsedConfirmations)
    .set({ status: 'matched', resolvedAt: new Date() })
    .where(eq(parsedConfirmations.id, id))
  await logAudit('confirmation', id, 'approved', undefined, teamId)
}

export async function snoozeConfirmation(
  id: string,
  teamId: string,
  hours = 24
): Promise<void> {
  await assertOwnership(id, teamId)
  const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000)
  await db
    .update(parsedConfirmations)
    .set({ snoozedUntil })
    .where(eq(parsedConfirmations.id, id))
  await logAudit(
    'confirmation',
    id,
    'snoozed',
    { hours, snoozedUntil: snoozedUntil.toISOString() },
    teamId
  )
}

export async function resolveConfirmation(id: string, teamId: string): Promise<void> {
  await assertOwnership(id, teamId)
  await db
    .update(parsedConfirmations)
    .set({ resolvedAt: new Date() })
    .where(eq(parsedConfirmations.id, id))
  await logAudit('confirmation', id, 'resolved', undefined, teamId)
}
