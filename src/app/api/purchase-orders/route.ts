import { NextRequest } from 'next/server'
import { listPurchaseOrders, createPurchaseOrder } from '@/lib/services/po.service'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  if (!session?.activeTeamId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pos = await listPurchaseOrders(session.activeTeamId)
  return Response.json(pos)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.activeTeamId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const po = await createPurchaseOrder(
    {
      poNumber,
      supplierName,
      expectedQty,
      expectedDeliveryDate,
      expectedUnitPrice,
      currency: currency ?? 'USD',
    },
    session.activeTeamId
  )

  return Response.json(po, { status: 201 })
}
