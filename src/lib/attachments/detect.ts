export class UnsupportedFileTypeError extends Error {
  constructor(type: string) {
    super(`Unsupported file type: ${type}`)
    this.name = 'UnsupportedFileTypeError'
  }
}

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number]

const EXT_TO_MIME: Record<string, SupportedMimeType> = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

// Detect MIME type from file magic bytes (first 8 bytes)
function sniffBuffer(buf: Buffer): string | null {
  // PDF: %PDF
  if (buf.slice(0, 4).toString('ascii') === '%PDF') return 'application/pdf'
  // PNG: \x89PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  // JPEG: \xff\xd8\xff
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  // XLSX/ZIP: PK\x03\x04
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  // XLS: \xd0\xcf\x11\xe0
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) {
    return 'application/vnd.ms-excel'
  }
  // WebP: RIFF????WEBP
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  return null
}

export function detectMimeType(
  buf: Buffer,
  filename: string,
  contentType?: string
): SupportedMimeType {
  // 1. Buffer magic bytes (most reliable)
  const sniffed = sniffBuffer(buf)
  if (sniffed && SUPPORTED_MIME_TYPES.includes(sniffed as SupportedMimeType)) {
    return sniffed as SupportedMimeType
  }

  // 2. File extension
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (EXT_TO_MIME[ext]) return EXT_TO_MIME[ext]

  // 3. Content-Type header (strip parameters)
  if (contentType) {
    const base = contentType.split(';')[0].trim().toLowerCase()
    if (SUPPORTED_MIME_TYPES.includes(base as SupportedMimeType)) {
      return base as SupportedMimeType
    }
  }

  throw new UnsupportedFileTypeError(contentType ?? filename)
}
