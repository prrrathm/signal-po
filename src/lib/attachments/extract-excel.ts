import * as XLSX from 'xlsx'

export function extractExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const parts: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      defval: '',
      header: 1,
    })

    if (rows.length === 0) continue

    parts.push(`Sheet: ${sheetName}`)
    for (const row of rows) {
      parts.push(row.map(String).join('\t'))
    }
  }

  return parts.join('\n')
}
