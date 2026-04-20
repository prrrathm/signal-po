import { createPurchaseOrder } from '@/lib/services/po.service'
import { storeEmail } from '@/lib/services/email.service'
import { enqueue } from '@/lib/queue/queue'
import { getSession } from '@/lib/auth/session'

const MOCK_POS = [
  {
    poNumber: 'PO-2024-001',
    supplierName: 'Acme Components Ltd',
    expectedQty: 500,
    expectedDeliveryDate: '2026-05-01',
    expectedUnitPrice: '12.50',
    currency: 'USD',
  },
  {
    poNumber: 'PO-2024-002',
    supplierName: 'Global Parts Inc',
    expectedQty: 200,
    expectedDeliveryDate: '2026-05-10',
    expectedUnitPrice: '45.00',
    currency: 'USD',
  },
  {
    poNumber: 'PO-2024-003',
    supplierName: 'FastShip Supplies',
    expectedQty: 1000,
    expectedDeliveryDate: '2026-04-28',
    expectedUnitPrice: '3.75',
    currency: 'USD',
  },
]

const MOCK_EMAILS = [
  {
    subject: 'RE: PO-2024-001 Confirmation',
    supplierName: 'Acme Components Ltd',
    emailBody: `Dear Team,

We are pleased to confirm your purchase order PO-2024-001.

Order details:
- Quantity confirmed: 500 units
- Unit price: $12.50
- Estimated delivery: May 1, 2026

Thank you for your business.

Best regards,
Acme Components Ltd`,
  },
  {
    subject: 'Order Confirmation - PO-2024-002',
    supplierName: 'Global Parts Inc',
    emailBody: `Hello,

This is to confirm receipt and acceptance of your order PO-2024-002.

We can confirm 150 units (out of 200 requested) at $45.00 per unit.
The remaining 50 units will ship in a second batch.

Delivery date: May 10, 2026.

Regards,
Global Parts Inc`,
  },
  {
    subject: 'PO-2024-003 - Delivery Delay Notice',
    supplierName: 'FastShip Supplies',
    emailBody: `Dear Customer,

We regret to inform you that your order PO-2024-003 will be delayed.

Confirmed details:
- Quantity: 1000 units
- Unit price: $3.75
- NEW delivery date: May 20, 2026 (originally April 28)

We apologize for any inconvenience.

FastShip Supplies`,
  },
  {
    subject: 'Price Update - PO-2024-001 Amendment',
    supplierName: 'Acme Components Ltd',
    emailBody: `Hi,

Please note a price amendment for PO-2024-001.

Due to increased raw material costs, the updated unit price is $14.00 (was $12.50).
Quantity remains 500 units, delivery May 1, 2026.

Please confirm acceptance.

Acme Components`,
  },
  {
    subject: 'Confirmation for your recent order',
    supplierName: 'Unknown Supplier',
    emailBody: `Hello,

Thanks for your order! We have processed order number PO-9999-XYZ.

Qty: 300 pieces
Price: $22.00 each
Ship date: sometime next month

Let us know if you have questions.`,
  },
]

export async function POST() {
  const session = await getSession()
  if (!session?.activeTeamId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamId = session.activeTeamId

  const createdPos = await Promise.all(MOCK_POS.map((po) => createPurchaseOrder(po, teamId)))

  const createdEmails = []
  for (const emailData of MOCK_EMAILS) {
    const email = await storeEmail(
      { subject: emailData.subject, body: emailData.emailBody, supplierName: emailData.supplierName },
      teamId
    )
    await enqueue(email.id)
    createdEmails.push(email)
  }

  return Response.json({
    message: 'Seeded successfully',
    purchaseOrders: createdPos.length,
    emails: createdEmails.length,
  })
}
