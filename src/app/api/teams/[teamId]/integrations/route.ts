import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { listIntegrations, addIntegration, buildWebhookUrl } from '@/lib/services/integration.service'
import { ForbiddenError } from '@/lib/services/team.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await params

  try {
    const integrations = await listIntegrations(session.user.id, teamId)
    const baseUrl = new URL(request.url).origin
    const webhookUrl = buildWebhookUrl(teamId, baseUrl)
    // Omit raw credentials from the response
    const safe = integrations.map(({ credentials: _creds, ...rest }) => rest)
    return Response.json({ integrations: safe, webhookUrl })
  } catch (err) {
    if (err instanceof ForbiddenError) return Response.json({ error: err.message }, { status: 403 })
    throw err
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await params
  const body = await request.json()

  const { type, provider, label, email, password, imapHost, imapPort } = body as {
    type: string
    provider: string
    label: string
    email?: string
    password?: string
    imapHost?: string
    imapPort?: number
  }

  if (!type || !provider || !label?.trim()) {
    return Response.json({ error: 'type, provider, and label are required' }, { status: 400 })
  }

  const imapProviders = ['gmail', 'outlook', 'yahoo', 'imap']
  const webhookProviders = ['sendgrid', 'postmark']

  try {
    let integration
    if (imapProviders.includes(provider)) {
      if (!email?.trim() || !password) {
        return Response.json({ error: 'email and password are required for IMAP connections' }, { status: 400 })
      }
      if (provider === 'imap' && !imapHost?.trim()) {
        return Response.json({ error: 'imapHost is required for custom IMAP connections' }, { status: 400 })
      }
      integration = await addIntegration(session.user.id, teamId, {
        type: 'imap',
        provider: provider as 'gmail' | 'outlook' | 'yahoo' | 'imap',
        label: label.trim(),
        email: email.trim(),
        password,
        imapHost,
        imapPort,
      })
    } else if (webhookProviders.includes(provider)) {
      integration = await addIntegration(session.user.id, teamId, {
        type: 'webhook',
        provider: provider as 'sendgrid' | 'postmark',
        label: label.trim(),
      })
    } else {
      return Response.json({ error: 'Unknown provider' }, { status: 400 })
    }

    const { credentials: _creds, ...safe } = integration
    return Response.json(safe, { status: 201 })
  } catch (err) {
    if (err instanceof ForbiddenError) return Response.json({ error: err.message }, { status: 403 })
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 400 })
  }
}
