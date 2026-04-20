import { extractPdf } from './extract-pdf'
import { extractExcel } from './extract-excel'
import { extractCsv } from './extract-csv'
import { extractImage } from './extract-image'

const MAX_TEXT_LENGTH = 12_000

export async function extractTextFromAttachment(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  let text: string

  switch (mimeType) {
    case 'application/pdf':
      text = await extractPdf(buffer)
      break

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
      text = extractExcel(buffer)
      break

    case 'text/csv':
    case 'text/plain':
      text = extractCsv(buffer)
      break

    case 'image/jpeg':
    case 'image/png':
    case 'image/webp':
      text = await extractImage(buffer)
      break

    default:
      throw new Error(`No extractor for MIME type: ${mimeType} (${filename})`)
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return text.slice(0, MAX_TEXT_LENGTH) + `\n[truncated — ${text.length - MAX_TEXT_LENGTH} chars omitted]`
  }
  return text
}
