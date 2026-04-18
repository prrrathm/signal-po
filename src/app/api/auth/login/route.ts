import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { createSession } from '@/lib/auth/session'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  await createSession(user.id)
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
}
