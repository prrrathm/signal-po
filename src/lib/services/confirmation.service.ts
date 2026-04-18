import { db } from '@/db'
import { parsedConfirmations, mismatches } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
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

export async function listConfirmations(): Promise<ConfirmationWithDetails[]> {
  const rows = await db.query.parsedConfirmations.findMany({
    orderBy: (c, { desc }) => [desc(c.createdAt)],
    with: {
      mismatches: true,
      email: {
        columns: { subject: true, receivedAt: true },
      },
      purchaseOrder: {
        columns: { poNumber: true, supplierName: true },
      },
    },
  })

  return rows.map((r) => ({
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
    email: r.email,
  }))
}

export async function getConfirmationById(id: string): Promise<ConfirmationWithDetails | null> {
  const r = await db.query.parsedConfirmations.findFirst({
    where: eq(parsedConfirmations.id, id),
    with: {
      mismatches: true,
      email: { columns: { subject: true, receivedAt: true } },
      purchaseOrder: { columns: { poNumber: true, supplierName: true } },
    },
  })
  if (!r) return null

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
    email: r.email,
  }
}
