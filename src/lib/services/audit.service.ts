import { db } from '@/db'
import { auditLogs } from '@/db/schema'

export async function logAudit(
  entityType: string,
  entityId: string,
  action: string,
  metadata?: Record<string, unknown>,
  teamId?: string
): Promise<void> {
  await db.insert(auditLogs).values({
    entityType,
    entityId,
    action,
    metadata: metadata ?? null,
    teamId: teamId ?? null,
  })
}
