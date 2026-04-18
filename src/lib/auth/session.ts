// Node.js only — do NOT import this in middleware (Edge runtime).
// Uses Drizzle (postgres driver) and next/headers.

import { db } from '@/db'
import { sessions, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { signToken, verifyToken, SESSION_COOKIE } from './token'

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export type Session = {
  user: { id: string; email: string; name: string | null }
}

/** Creates a DB session record and sets the HttpOnly session cookie. */
export async function createSession(userId: string): Promise<void> {
  const sessionId = crypto.randomUUID()
  const token = await signToken(sessionId)
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS)

  await db.insert(sessions).values({ sessionToken: sessionId, userId, expires })

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path: '/',
  })
}

/**
 * Reads the session cookie, verifies the HMAC, looks up the session in the DB,
 * and returns the associated user — or null if unauthenticated / expired.
 */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const sessionId = await verifyToken(token)
  if (!sessionId) return null

  const [row] = await db
    .select({
      expires: sessions.expires,
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.sessionToken, sessionId))

  if (!row) return null

  if (row.expires < new Date()) {
    await db.delete(sessions).where(eq(sessions.sessionToken, sessionId))
    return null
  }

  return { user: { id: row.id, email: row.email, name: row.name } }
}

/** Deletes the DB session record and clears the session cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value

  if (token) {
    const sessionId = await verifyToken(token)
    if (sessionId) {
      await db.delete(sessions).where(eq(sessions.sessionToken, sessionId))
    }
  }

  jar.delete(SESSION_COOKIE)
}
