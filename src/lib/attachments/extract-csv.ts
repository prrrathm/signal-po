import Papa from 'papaparse'

export function extractCsv(buffer: Buffer): string {
  const csv = buffer.toString('utf-8')
  const result = Papa.parse<string[]>(csv, { skipEmptyLines: true })
  return result.data.map((row) => row.join('\t')).join('\n')
}
