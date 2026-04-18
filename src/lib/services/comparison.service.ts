import type { PurchaseOrder } from '@/db/schema'
import type { ExtractionResult, ComparisonResult, MismatchInput } from '../types'

const DATE_DELAY_DAYS = 3
const PRICE_DEVIATION_THRESHOLD = 0.05  // 5%

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function compareWithPo(
  extraction: ExtractionResult,
  po: PurchaseOrder | null
): ComparisonResult {
  if (!po) {
    return {
      status: 'unmatched',
      mismatches: [
        {
          type: 'unmatched',
          severity: 'high',
          description: `No purchase order found for PO number: ${extraction.po_number ?? 'unknown'}`,
        },
      ],
    }
  }

  const mismatches: MismatchInput[] = []

  // Quantity check
  if (extraction.confirmed_qty !== null && extraction.confirmed_qty < Number(po.expectedQty)) {
    const diff = Number(po.expectedQty) - extraction.confirmed_qty
    mismatches.push({
      type: 'quantity',
      severity: diff / Number(po.expectedQty) > 0.2 ? 'high' : 'medium',
      description: `Confirmed qty ${extraction.confirmed_qty} is less than expected ${po.expectedQty} (short by ${diff})`,
    })
  }

  // Date check
  const confirmedDate = parseDate(extraction.delivery_date)
  const expectedDate = parseDate(po.expectedDeliveryDate)
  if (confirmedDate && expectedDate) {
    const threshold = addDays(expectedDate, DATE_DELAY_DAYS)
    if (confirmedDate > threshold) {
      const delayMs = confirmedDate.getTime() - expectedDate.getTime()
      const delayDays = Math.round(delayMs / (1000 * 60 * 60 * 24))
      mismatches.push({
        type: 'date',
        severity: delayDays > 14 ? 'high' : 'medium',
        description: `Delivery date ${extraction.delivery_date} is ${delayDays} days late (expected ${po.expectedDeliveryDate})`,
      })
    }
  }

  // Price check
  if (extraction.unit_price !== null) {
    const expected = parseFloat(po.expectedUnitPrice)
    const deviation = Math.abs(extraction.unit_price - expected) / expected
    if (deviation > PRICE_DEVIATION_THRESHOLD) {
      const pct = (deviation * 100).toFixed(1)
      mismatches.push({
        type: 'price',
        severity: deviation > 0.15 ? 'high' : 'medium',
        description: `Unit price ${extraction.unit_price} deviates ${pct}% from expected ${po.expectedUnitPrice}`,
      })
    }
  }

  if (mismatches.length === 0) {
    return { status: 'matched', mismatches: [] }
  }

  const hasHigh = mismatches.some((m) => m.severity === 'high')
  return {
    status: hasHigh ? 'high_priority_flag' : 'needs_review',
    mismatches,
  }
}
