import { db } from '@/db'
import { teamEmailIntegrations } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { assertTeamRole, assertTeamMember } from './team.service'
import type { TeamEmailIntegration, EmailIntegrationProvider } from '@/db/schema'

// IMAP defaults per provider
const IMAP_DEFAULTS: Partial<Record<EmailIntegrationProvider, { host: string; port: number }>> = {
  gmail: { host: 'imap.gmail.com', port: 993 },
  outlook: { host: 'outlook.office365.com', port: 993 },
  yahoo: { host: 'imap.mail.yahoo.com', port: 993 },
}

export type CreateImapIntegrationInput = {
  provider: 'gmail' | 'outlook' | 'yahoo' | 'imap'
  label: string
  email: string
  password: string
  imapHost?: string
  imapPort?: number
}

export type CreateWebhookIntegrationInput = {
  provider: 'sendgrid' | 'postmark'
  label: string
}

export type CreateIntegrationInput =
  | ({ type: 'imap' } & CreateImapIntegrationInput)
  | ({ type: 'webhook' } & CreateWebhookIntegrationInput)

export async function listIntegrations(
  actorId: string,
  teamId: string
): Promise<TeamEmailIntegration[]> {
  await assertTeamMember(actorId, teamId)

  return db
    .select()
    .from(teamEmailIntegrations)
    .where(eq(teamEmailIntegrations.teamId, teamId))
    .orderBy(teamEmailIntegrations.createdAt)
}

export async function addIntegration(
  actorId: string,
  teamId: string,
  input: CreateIntegrationInput
): Promise<TeamEmailIntegration> {
  await assertTeamRole(actorId, teamId, 'admin')

  if (input.type === 'imap') {
    const defaults = IMAP_DEFAULTS[input.provider]
    const host = input.imapHost ?? defaults?.host
    const port = input.imapPort ?? defaults?.port ?? 993

    if (!host) {
      throw new Error('IMAP host is required for custom IMAP connections')
    }

    const [integration] = await db
      .insert(teamEmailIntegrations)
      .values({
        teamId,
        provider: input.provider,
        label: input.label,
        email: input.email,
        imapHost: host,
        imapPort: port,
        credentials: { password: input.password },
        status: 'pending',
      })
      .returning()

    return integration
  }

  // Webhook integration — no credentials stored, just registration
  const [integration] = await db
    .insert(teamEmailIntegrations)
    .values({
      teamId,
      provider: input.provider,
      label: input.label,
      status: 'active',
    })
    .returning()

  return integration
}

export async function removeIntegration(
  actorId: string,
  teamId: string,
  integrationId: string
): Promise<void> {
  await assertTeamRole(actorId, teamId, 'admin')

  await db
    .delete(teamEmailIntegrations)
    .where(
      and(
        eq(teamEmailIntegrations.id, integrationId),
        eq(teamEmailIntegrations.teamId, teamId)
      )
    )
}

export function buildWebhookUrl(teamId: string, baseUrl: string): string {
  const secret = process.env.INBOUND_WEBHOOK_SECRET ?? ''
  return `${baseUrl}/api/emails/inbound?teamId=${teamId}&token=${secret}`
}
