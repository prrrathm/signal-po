import type { ExtractionResult } from '../types'

const MODEL = 'meta-llama/llama-3.3-70b-instruct:free'

const SYSTEM_PROMPT = `You are a purchase order data extraction specialist.
Extract structured fields from supplier confirmation emails.
Always respond with valid JSON only — no markdown, no explanation, no code blocks.
If a field cannot be found or is unclear, set it to null.
Set confidence between 0.0 and 1.0 based on how clearly the fields were stated.

Required JSON shape:
{
  "po_number": string | null,
  "confirmed_qty": number | null,
  "delivery_date": string | null,  // ISO format: YYYY-MM-DD
  "unit_price": number | null,
  "currency": string | null,
  "notes": string | null,
  "confidence": number
}`

const FALLBACK: ExtractionResult = {
  po_number: null,
  confirmed_qty: null,
  delivery_date: null,
  unit_price: null,
  currency: null,
  notes: null,
  confidence: 0,
}

export async function extractFromEmail(
  subject: string,
  body: string
): Promise<ExtractionResult> {
  const userMessage = `Subject: ${subject}\n\n${body}`

  let text = ''
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    }

    text = data.choices[0]?.message?.content?.trim() ?? ''
    if (!text) return FALLBACK

    const parsed = JSON.parse(text) as ExtractionResult

    // Validate shape
    return {
      po_number: parsed.po_number ?? null,
      confirmed_qty: typeof parsed.confirmed_qty === 'number' ? parsed.confirmed_qty : null,
      delivery_date: parsed.delivery_date ?? null,
      unit_price: typeof parsed.unit_price === 'number' ? parsed.unit_price : null,
      currency: parsed.currency ?? null,
      notes: parsed.notes ?? null,
      confidence: typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0,
    }
  } catch {
    return { ...FALLBACK, notes: text ? `Parse error; raw: ${text.slice(0, 200)}` : null }
  }
}
