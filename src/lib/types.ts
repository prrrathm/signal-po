export interface ExtractionResult {
  po_number: string | null
  confirmed_qty: number | null
  delivery_date: string | null   // ISO date string YYYY-MM-DD
  unit_price: number | null
  currency: string | null
  notes: string | null
  confidence: number             // 0.0–1.0
}

export interface MismatchInput {
  type: 'quantity' | 'date' | 'price' | 'unmatched'
  severity: 'high' | 'medium' | 'low'
  description: string
}

export interface ComparisonResult {
  status: 'matched' | 'needs_review' | 'high_priority_flag' | 'unmatched'
  mismatches: MismatchInput[]
}

export interface ConfirmationWithDetails {
  id: string
  emailId: string
  poId: string | null
  poNumber: string | null
  supplierName: string | null
  confirmedQty: number | null
  confirmedDeliveryDate: string | null
  confirmedUnitPrice: string | null
  currency: string | null
  extractedNotes: string | null
  confidence: number
  status: 'matched' | 'needs_review' | 'high_priority_flag' | 'unmatched'
  rawJson: unknown
  resolvedAt: Date | null
  snoozedUntil: Date | null
  createdAt: Date
  mismatches: {
    id: string
    type: string
    severity: string
    description: string
    resolved: string
  }[]
  email: {
    subject: string
    receivedAt: Date
  }
}
