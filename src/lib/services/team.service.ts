import { db } from '@/db'
import { teams, teamMembers, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { Team, TeamMember, TeamRole, User } from '@/db/schema'

const ROLE_RANK: Record<TeamRole, number> = { member: 0, admin: 1, owner: 2 }

export class ForbiddenError extends Error {
  status = 403
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

function sanitizeSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function generateSlug(email: string, userId: string): string {
  const prefix = sanitizeSlug(email.split('@')[0])
  // Use last 6 chars of userId for uniqueness
  const suffix = userId.replace(/-/g, '').slice(-6)
  return `${prefix}-${suffix}`
}

export async function createPersonalTeam(
  userId: string,
  displayName: string,
  email: string
): Promise<Team> {
  const slug = generateSlug(email, userId)
  const [team] = await db
    .insert(teams)
    .values({ name: displayName || email.split('@')[0], slug })
    .returning()

  await db.insert(teamMembers).values({ teamId: team.id, userId, role: 'owner' })

  return team
}

export async function getTeamsForUser(
  userId: string
): Promise<Array<Team & { role: TeamRole }>> {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      createdAt: teams.createdAt,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))
    .orderBy(teams.createdAt)

  return rows
}

/** Returns the user's role in the team, or throws ForbiddenError if not a member. */
export async function assertTeamMember(userId: string, teamId: string): Promise<TeamRole> {
  const [row] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)))

  if (!row) throw new ForbiddenError('You are not a member of this team')
  return row.role
}

/** Throws ForbiddenError if user's role is below minimumRole. */
export async function assertTeamRole(
  userId: string,
  teamId: string,
  minimumRole: TeamRole
): Promise<void> {
  const role = await assertTeamMember(userId, teamId)
  if (ROLE_RANK[role] < ROLE_RANK[minimumRole]) {
    throw new ForbiddenError(`Requires ${minimumRole} role or higher`)
  }
}

export async function listTeamMembers(
  actorId: string,
  teamId: string
): Promise<Array<TeamMember & { user: Pick<User, 'id' | 'name' | 'email'> }>> {
  await assertTeamMember(actorId, teamId)

  return db
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
      createdAt: teamMembers.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(teamMembers.createdAt)
}

export async function updateTeamName(
  actorId: string,
  teamId: string,
  name: string
): Promise<Team> {
  await assertTeamRole(actorId, teamId, 'admin')
  const [team] = await db
    .update(teams)
    .set({ name })
    .where(eq(teams.id, teamId))
    .returning()
  return team
}

export async function inviteMember(
  actorId: string,
  teamId: string,
  email: string,
  role: TeamRole
): Promise<TeamMember> {
  await assertTeamRole(actorId, teamId, 'admin')

  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user) throw new Error('No account found for that email address')

  const [member] = await db
    .insert(teamMembers)
    .values({ teamId, userId: user.id, role })
    .returning()
  return member
}

export async function removeMember(
  actorId: string,
  teamId: string,
  targetUserId: string
): Promise<void> {
  const actorRole = await assertTeamMember(actorId, teamId)

  // Users can always remove themselves
  if (actorId !== targetUserId) {
    if (ROLE_RANK[actorRole] < ROLE_RANK['admin']) {
      throw new ForbiddenError('Requires admin role or higher')
    }

    // Check if target is an owner — only another owner can remove an owner
    const [target] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, targetUserId), eq(teamMembers.teamId, teamId)))

    if (target?.role === 'owner' && actorRole !== 'owner') {
      throw new ForbiddenError('Only an owner can remove another owner')
    }
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.userId, targetUserId), eq(teamMembers.teamId, teamId)))
}

export async function changeMemberRole(
  actorId: string,
  teamId: string,
  targetUserId: string,
  role: TeamRole
): Promise<void> {
  const actorRole = await assertTeamMember(actorId, teamId)

  // Promoting to owner requires actor to be owner
  if (role === 'owner' && actorRole !== 'owner') {
    throw new ForbiddenError('Only an owner can grant the owner role')
  }

  // Demoting requires admin+
  if (ROLE_RANK[actorRole] < ROLE_RANK['admin']) {
    throw new ForbiddenError('Requires admin role or higher')
  }

  await db
    .update(teamMembers)
    .set({ role })
    .where(and(eq(teamMembers.userId, targetUserId), eq(teamMembers.teamId, teamId)))
}

export async function deleteTeam(actorId: string, teamId: string): Promise<void> {
  await assertTeamRole(actorId, teamId, 'owner')
  await db.delete(teams).where(eq(teams.id, teamId))
}
