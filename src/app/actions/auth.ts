'use server'

import { db } from '@/db'
import { users, teamMembers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { createSession, destroySession, setActiveTeam } from '@/lib/auth/session'
import { createPersonalTeam } from '@/lib/services/team.service'

export async function login(_prev: unknown, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const callbackUrl = (formData.get('callbackUrl') as string) || '/dashboard'

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user || !user.passwordHash) {
    return { error: 'Invalid email or password.' }
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return { error: 'Invalid email or password.' }
  }

  await createSession(user.id)

  // Set the active team to the user's first (personal) team
  const [firstMembership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id))
    .orderBy(teamMembers.createdAt)
    .limit(1)

  if (firstMembership) {
    await setActiveTeam(firstMembership.teamId)
  }

  redirect(callbackUrl)
}

export async function register(_prev: unknown, formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email))
  if (existing) {
    return { error: 'An account with this email already exists.' }
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const [newUser] = await db
    .insert(users)
    .values({ name: name || null, email, passwordHash })
    .returning()

  await createPersonalTeam(newUser.id, name || email.split('@')[0], email)

  redirect('/login?registered=1')
}

export async function logout() {
  await destroySession()
  redirect('/login')
}
