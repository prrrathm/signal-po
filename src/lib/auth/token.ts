// Edge-compatible: uses only crypto.subtle (Web Crypto API).
// Safe to import in Next.js middleware (Edge runtime).

export const SESSION_COOKIE = 'session_token'

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET env var is not set')
  return s
}

async function hmacKey(s: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(s),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function toBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/** Returns `<sessionId>.<hmac-signature>` */
export async function signToken(sessionId: string): Promise<string> {
  const key = await hmacKey(secret())
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sessionId))
  return `${sessionId}.${toBase64Url(sig)}`
}

/**
 * Verifies the HMAC signature and returns the sessionId, or null if invalid.
 * Uses a constant-time comparison to prevent timing attacks.
 */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const cut = token.lastIndexOf('.')
    if (cut === -1) return null
    const sessionId = token.slice(0, cut)
    const sig = token.slice(cut + 1)
    if (!sessionId || !sig) return null

    const expected = await signToken(sessionId)
    const expectedSig = expected.slice(expected.lastIndexOf('.') + 1)

    if (sig.length !== expectedSig.length) return null

    // Constant-time char comparison
    let diff = 0
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i)
    }
    return diff === 0 ? sessionId : null
  } catch {
    return null
  }
}
