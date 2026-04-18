import { extractFromEmail } from '../llm/extract'
import type { ExtractionResult } from '../types'

export async function extractEmailData(
  subject: string,
  body: string
): Promise<ExtractionResult> {
  return extractFromEmail(subject, body)
}
