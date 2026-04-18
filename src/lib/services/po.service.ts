import { db } from '@/db'
import { purchaseOrders } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { PurchaseOrder, NewPurchaseOrder } from '@/db/schema'

export async function createPurchaseOrder(
  data: Omit<NewPurchaseOrder, 'id' | 'createdAt'>
): Promise<PurchaseOrder> {
  const [po] = await db.insert(purchaseOrders).values(data).returning()
  return po
}

export async function findPoByNumber(poNumber: string): Promise<PurchaseOrder | null> {
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.poNumber, poNumber))
  return po ?? null
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  return db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt))
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id))
  return po ?? null
}
