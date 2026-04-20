import fs from 'node:fs/promises'
import path from 'node:path'

function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
}

function resolvedPath(key: string): string {
  // Prevent path traversal
  const safe = key.replace(/\.\./g, '_')
  return path.join(uploadDir(), safe)
}

export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  const dest = resolvedPath(key)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, buffer)
}

export async function getFile(key: string): Promise<Buffer> {
  const src = resolvedPath(key)
  return Buffer.from(await fs.readFile(src))
}

export async function deleteFile(key: string): Promise<void> {
  try {
    await fs.unlink(resolvedPath(key))
  } catch {
    // ignore missing files
  }
}
