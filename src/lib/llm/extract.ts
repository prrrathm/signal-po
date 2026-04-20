import type { ExtractionResult } from '../types'

const MODEL = 'meta-llama/llama-3.3-70b-instruct:free'

const SYSTEM_PROMPT = `You are a purchase order data extraction specialist.
Extract structured fields from supplier confirmation emails and attachments.
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

const CHUNK_SIZE = 8_000

function buildUserMessage(subject: string, body: string, attachmentTexts: string[]): string {
  const parts = [`Subject: ${subject}`, '', body]
  if (attachmentTexts.length > 0) {
    parts.push('', ...attachmentTexts)
  }
  return parts.join('\n')
}

function chunkText(text: string): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE))
  }
  return chunks.length > 0 ? chunks : [text]
}

function mergeResults(results: ExtractionResult[]): ExtractionResult {
  // Take the result with highest confidence; for null fields, try other results
  const best = results.reduce((a, b) => (b.confidence > a.confidence ? b : a), results[0])
  return {
    po_number: results.find((r) => r.po_number)?.po_number ?? null,
    confirmed_qty: results.find((r) => r.confirmed_qty != null)?.confirmed_qty ?? null,
    delivery_date: results.find((r) => r.delivery_date)?.delivery_date ?? null,
    unit_price: results.find((r) => r.unit_price != null)?.unit_price ?? null,
    currency: results.find((r) => r.currency)?.currency ?? null,
    notes: best.notes,
    confidence: best.confidence,
  }
}

async function callLlm(userMessage: string): Promise<ExtractionResult> {
  let text = ''
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
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
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    return {
      ...FALLBACK,
      notes: isTimeout
        ? 'OpenRouter request timed out after 90s'
        : text ? `Parse error; raw: ${text.slice(0, 200)}` : null,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function extractFromEmail(
  subject: string,
  body: string,
  attachmentTexts: string[] = []
): Promise<ExtractionResult> {
  const fullMessage = buildUserMessage(subject, body, attachmentTexts)

  if (fullMessage.length <= CHUNK_SIZE) {
    return callLlm(fullMessage)
  }

  // Chunk large content and merge results
  const chunks = chunkText(fullMessage)
  const results = await Promise.all(
    chunks.map((chunk) => callLlm(`Subject: ${subject}\n\n[Chunk]\n${chunk}`))
  )
  return mergeResults(results)
}
