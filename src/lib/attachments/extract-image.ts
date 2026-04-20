export async function extractImage(buffer: Buffer): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  const { data } = await worker.recognize(buffer)
  await worker.terminate()
  return data.text?.trim() ?? ''
}
