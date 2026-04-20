import { db } from '@/db'
import { purchaseOrders } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { PurchaseOrder, NewPurchaseOrder } from '@/db/schema'

export async function createPurchaseOrder(
  data: Omit<NewPurchaseOrder, 'id' | 'createdAt' | 'teamId'>,
  teamId: string
): Promise<PurchaseOrder> {
  const [po] = await db
    .insert(purchaseOrders)
    .values({ ...data, teamId })
    .onConflictDoNothing()
    .returning()

  if (po) return po

  // Row already exists — return it
  const [existing] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.poNumber, data.poNumber), eq(purchaseOrders.teamId, teamId)))
  return existing
}

export async function findPoByNumber(
  poNumber: string,
  teamId: string
): Promise<PurchaseOrder | null> {
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.poNumber, poNumber), eq(purchaseOrders.teamId, teamId)))
  return po ?? null
}

export async function listPurchaseOrders(teamId: string): Promise<PurchaseOrder[]> {
  return db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.teamId, teamId))
    .orderBy(desc(purchaseOrders.createdAt))
}

export async function getPurchaseOrderById(
  id: string,
  teamId: string
): Promise<PurchaseOrder | null> {
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.teamId, teamId)))
  return po ?? null
}
