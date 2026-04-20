import { db } from '@/db'
import { parsedConfirmations, mismatches, emails } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import type { ExtractionResult, ComparisonResult, ConfirmationWithDetails } from '../types'

export async function saveConfirmation(params: {
  emailId: string
  poId: string | null
  extraction: ExtractionResult
  comparison: ComparisonResult
}): Promise<string> {
  const [confirmation] = await db
    .insert(parsedConfirmations)
    .values({
      emailId: params.emailId,
      poId: params.poId,
      confirmedQty: params.extraction.confirmed_qty,
      confirmedDeliveryDate: params.extraction.delivery_date,
      confirmedUnitPrice: params.extraction.unit_price?.toString() ?? null,
      currency: params.extraction.currency,
      extractedNotes: params.extraction.notes,
      confidence: params.extraction.confidence,
      status: params.comparison.status,
      rawJson: params.extraction as unknown as Record<string, unknown>,
    })
    .returning()

  if (params.comparison.mismatches.length > 0) {
    await db.insert(mismatches).values(
      params.comparison.mismatches.map((m) => ({
        parsedConfirmationId: confirmation.id,
        type: m.type,
        severity: m.severity,
        description: m.description,
      }))
    )
  }

  return confirmation.id
}

function buildFetchConfirmations(teamId: string) {
  return unstable_cache(
    async (): Promise<ConfirmationWithDetails[]> => {
      const rows = await db.query.parsedConfirmations.findMany({
        orderBy: (c, { desc }) => [desc(c.createdAt)],
        with: {
          mismatches: true,
          email: {
            columns: { subject: true, receivedAt: true, teamId: true },
          },
          purchaseOrder: {
            columns: { poNumber: true, supplierName: true },
          },
        },
      })

      // Filter to only confirmations belonging to this team (via the email's teamId)
      return rows
        .filter((r) => r.email?.teamId === teamId)
        .map((r) => ({
          id: r.id,
          emailId: r.emailId,
          poId: r.poId,
          poNumber: r.purchaseOrder?.poNumber ?? null,
          supplierName: r.purchaseOrder?.supplierName ?? null,
          confirmedQty: r.confirmedQty,
          confirmedDeliveryDate: r.confirmedDeliveryDate,
          confirmedUnitPrice: r.confirmedUnitPrice,
          currency: r.currency,
          extractedNotes: r.extractedNotes,
          confidence: r.confidence,
          status: r.status,
          rawJson: r.rawJson,
          resolvedAt: r.resolvedAt,
          snoozedUntil: r.snoozedUntil,
          createdAt: r.createdAt,
          mismatches: r.mismatches.map((m) => ({
            id: m.id,
            type: m.type,
            severity: m.severity,
            description: m.description,
            resolved: m.resolved,
          })),
          email: { subject: r.email!.subject, receivedAt: r.email!.receivedAt },
        }))
    },
    ['confirmations', teamId],
    { tags: [`confirmations:${teamId}`], revalidate: 30 }
  )
}

export async function listConfirmations(teamId: string): Promise<ConfirmationWithDetails[]> {
  return buildFetchConfirmations(teamId)()
}

export async function getConfirmationById(
  id: string,
  teamId: string
): Promise<ConfirmationWithDetails | null> {
  const r = await db.query.parsedConfirmations.findFirst({
    where: eq(parsedConfirmations.id, id),
    with: {
      mismatches: true,
      email: { columns: { subject: true, receivedAt: true, teamId: true } },
      purchaseOrder: { columns: { poNumber: true, supplierName: true } },
    },
  })
  if (!r) return null

  // Enforce team ownership via the linked email's teamId
  if (r.email?.teamId !== teamId) return null

  return {
    id: r.id,
    emailId: r.emailId,
    poId: r.poId,
    poNumber: r.purchaseOrder?.poNumber ?? null,
    supplierName: r.purchaseOrder?.supplierName ?? null,
    confirmedQty: r.confirmedQty,
    confirmedDeliveryDate: r.confirmedDeliveryDate,
    confirmedUnitPrice: r.confirmedUnitPrice,
    currency: r.currency,
    extractedNotes: r.extractedNotes,
    confidence: r.confidence,
    status: r.status,
    rawJson: r.rawJson,
    resolvedAt: r.resolvedAt,
    snoozedUntil: r.snoozedUntil,
    createdAt: r.createdAt,
    mismatches: r.mismatches.map((m) => ({
      id: m.id,
      type: m.type,
      severity: m.severity,
      description: m.description,
      resolved: m.resolved,
    })),
    email: { subject: r.email!.subject, receivedAt: r.email!.receivedAt },
  }
}

