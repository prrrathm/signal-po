import { NextRequest } from 'next/server'
import { listPurchaseOrders, createPurchaseOrder } from '@/lib/services/po.service'

export async function GET() {
  const pos = await listPurchaseOrders()
  return Response.json(pos)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { poNumber, supplierName, expectedQty, expectedDeliveryDate, expectedUnitPrice, currency } =
    body as {
      poNumber: string
      supplierName: string
      expectedQty: number
      expectedDeliveryDate: string
      expectedUnitPrice: string
      currency?: string
    }

  if (!poNumber || !supplierName || !expectedQty || !expectedDeliveryDate || !expectedUnitPrice) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const po = await createPurchaseOrder({
    poNumber,
    supplierName,
    expectedQty,
    expectedDeliveryDate,
    expectedUnitPrice,
    currency: currency ?? 'USD',
  })

  return Response.json(po, { status: 201 })
}
