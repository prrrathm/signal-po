import { PDFParse } from 'pdf-parse'

const SCANNED_TEXT_THRESHOLD = 200

export async function extractPdf(buffer: Buffer): Promise<string> {
  let text = ''
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    text = result.text?.trim() ?? ''
    await parser.destroy()
  } catch {
    // pdf-parse failed — fall through to OCR
  }

  if (text.length >= SCANNED_TEXT_THRESHOLD) {
    return text
  }

  // Fallback: OCR via tesseract.js
  try {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng')
    const { data } = await worker.recognize(buffer)
    await worker.terminate()
    return data.text?.trim() ?? ''
  } catch (err) {
    if (text.length > 0) return text
    throw new Error(`PDF extraction failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
