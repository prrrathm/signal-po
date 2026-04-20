'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { TeamRole, EmailIntegrationProvider, EmailIntegrationStatus } from '@/db/schema'

type Member = {
  id: string
  userId: string
  role: TeamRole
  createdAt: Date
  user: { id: string; name: string | null; email: string }
}

type Team = {
  id: string
  name: string
  slug: string
  role: TeamRole
}

type Integration = {
  id: string
  teamId: string
  provider: EmailIntegrationProvider
  label: string
  email: string | null
  imapHost: string | null
  imapPort: number | null
  status: EmailIntegrationStatus
  errorMessage: string | null
  createdAt: Date
}

const ROLE_COLORS: Record<TeamRole, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  member: 'bg-gray-100 text-gray-700',
}

const PROVIDER_LABELS: Record<EmailIntegrationProvider, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  yahoo: 'Yahoo Mail',
  imap: 'Custom IMAP',
  sendgrid: 'SendGrid',
  postmark: 'Postmark',
}

const STATUS_COLORS: Record<EmailIntegrationStatus, string> = {
  active: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-700',
}

const IMAP_PROVIDERS: EmailIntegrationProvider[] = ['gmail', 'outlook', 'yahoo', 'imap']
const WEBHOOK_PROVIDERS: EmailIntegrationProvider[] = ['sendgrid', 'postmark']

const WEBHOOK_SETUP: Record<string, { name: string; docUrl: string; steps: string[] }> = {
  sendgrid: {
    name: 'SendGrid Inbound Parse',
    docUrl: 'https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook',
    steps: [
      'Go to SendGrid → Settings → Inbound Parse',
      'Add a new host and set the Destination URL to your webhook URL below',
      'Optionally enable "Post the raw, full MIME message"',
    ],
  },
  postmark: {
    name: 'Postmark Inbound',
    docUrl: 'https://postmarkapp.com/developer/user-guide/inbound',
    steps: [
      'Go to your Postmark server → Settings → Inbound',
      'Set the Inbound Webhook URL to your webhook URL below',
      'Save changes',
    ],
  },
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs shrink-0"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  )
}

function AddIntegrationForm({
  teamId,
  onSuccess,
}: {
  teamId: string
  onSuccess: () => void
}) {
  const [provider, setProvider] = useState<EmailIntegrationProvider>('gmail')
  const [label, setLabel] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState('993')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isImap = IMAP_PROVIDERS.includes(provider)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = { type: isImap ? 'imap' : 'webhook', provider, label }
      if (isImap) {
        body.email = email
        body.password = password
        if (provider === 'imap') {
          body.imapHost = imapHost
          body.imapPort = Number(imapPort) || 993
        }
      }
      const res = await fetch(`/api/teams/${teamId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to add integration')
      } else {
        onSuccess()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4 bg-gray-50">
      <div>
        <Label className="text-xs font-medium mb-1 block">Provider</Label>
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as EmailIntegrationProvider)
            setLabel('')
          }}
          className="h-9 w-full rounded-md border border-input px-2 text-sm"
        >
          <optgroup label="IMAP (direct mailbox access)">
            {IMAP_PROVIDERS.map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </optgroup>
          <optgroup label="Webhook (email service routing)">
            {WEBHOOK_PROVIDERS.map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </optgroup>
        </select>
      </div>

      <div>
        <Label htmlFor="int-label" className="text-xs font-medium mb-1 block">Label</Label>
        <Input
          id="int-label"
          placeholder={isImap ? 'e.g. Orders inbox' : `e.g. ${PROVIDER_LABELS[provider]} integration`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
      </div>

      {isImap && (
        <>
          <div>
            <Label htmlFor="int-email" className="text-xs font-medium mb-1 block">Email address</Label>
            <Input
              id="int-email"
              type="email"
              placeholder="orders@yourcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="int-password" className="text-xs font-medium mb-1 block">
              {provider === 'gmail' ? 'App password' : provider === 'outlook' ? 'App password' : 'Password'}
            </Label>
            {(provider === 'gmail' || provider === 'outlook') && (
              <p className="text-xs text-gray-500 mb-1">
                {provider === 'gmail'
                  ? 'Use a Gmail app password (requires 2FA). Do not use your main account password.'
                  : 'Use an Outlook app password from your Microsoft account security settings.'}
              </p>
            )}
            <Input
              id="int-password"
              type="password"
              placeholder="••••••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {provider === 'imap' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="int-host" className="text-xs font-medium mb-1 block">IMAP host</Label>
                <Input
                  id="int-host"
                  placeholder="imap.yourprovider.com"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  required
                />
              </div>
              <div className="w-24">
                <Label htmlFor="int-port" className="text-xs font-medium mb-1 block">Port</Label>
                <Input
                  id="int-port"
                  type="number"
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value)}
                />
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving || !label.trim()}>
          {saving ? 'Connecting...' : 'Connect'}
        </Button>
      </div>
    </form>
  )
}

export function TeamSettingsClient({
  team,
  members,
  currentUserId,
  currentUserRole,
  integrations: initialIntegrations,
  webhookUrl,
}: {
  team: Team
  members: Member[]
  currentUserId: string
  currentUserRole: TeamRole
  integrations: Integration[]
  webhookUrl: string
}) {
  const router = useRouter()
  const [teamName, setTeamName] = useState(team.name)
  const [nameError, setNameError] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('member')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [showAddIntegration, setShowAddIntegration] = useState(false)

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'

  async function handleRenameTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) return
    setSaving(true)
    setNameError('')
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setNameError(data.error ?? 'Failed to update team name')
      } else {
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')
    try {
      const res = await fetch(`/api/teams/${team.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteError(data.error ?? 'Failed to invite member')
      } else {
        setInviteSuccess(`${inviteEmail} added to team.`)
        setInviteEmail('')
        router.refresh()
      }
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(userId: string) {
    await fetch(`/api/teams/${team.id}/members/${userId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function handleRoleChange(userId: string, role: TeamRole) {
    await fetch(`/api/teams/${team.id}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    router.refresh()
  }

  async function handleRemoveIntegration(id: string) {
    await fetch(`/api/teams/${team.id}/integrations/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {/* Team Name */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Team Name</h2>
        <form onSubmit={handleRenameTeam} className="flex gap-2">
          <Input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            disabled={!canManage || saving}
            className="max-w-xs"
          />
          {canManage && (
            <Button type="submit" size="sm" disabled={saving || teamName === team.name}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </form>
        {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
      </section>

      <Separator />

      {/* Members */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Members</h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                {m.user.name && (
                  <p className="text-xs text-gray-500">{m.user.email}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${ROLE_COLORS[m.role]}`}>{m.role}</Badge>
                {canManage && m.userId !== currentUserId && m.role !== 'owner' && (
                  <>
                    {currentUserRole === 'owner' && m.role === 'member' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => handleRoleChange(m.userId, 'admin')}
                      >
                        Make admin
                      </Button>
                    )}
                    {currentUserRole === 'owner' && m.role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => handleRoleChange(m.userId, 'member')}
                      >
                        Make member
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-red-600 hover:text-red-700"
                      onClick={() => handleRemove(m.userId)}
                    >
                      Remove
                    </Button>
                  </>
                )}
                {m.userId === currentUserId && (
                  <span className="text-xs text-gray-400">You</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Invite */}
      {canManage && (
        <>
          <Separator />
          <section>
            <h2 className="text-sm font-semibold mb-3">Invite Member</h2>
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting}
                className="max-w-xs"
              />
              <div>
                <Label htmlFor="invite-role" className="sr-only">Role</Label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                  disabled={inviting}
                  className="h-9 rounded-md border border-input px-2 text-sm"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  {currentUserRole === 'owner' && <option value="owner">Owner</option>}
                </select>
              </div>
              <Button type="submit" size="sm" disabled={inviting || !inviteEmail.trim()}>
                {inviting ? 'Inviting...' : 'Invite'}
              </Button>
            </form>
            {inviteError && <p className="text-xs text-red-600 mt-1">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-green-600 mt-1">{inviteSuccess}</p>}
          </section>
        </>
      )}

      <Separator />

      {/* Email Integrations */}
      <section>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-sm font-semibold">Email Integrations</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Connect a mailbox or email service so incoming supplier confirmations are automatically processed.
            </p>
          </div>
          {canManage && !showAddIntegration && (
            <Button size="sm" variant="outline" onClick={() => setShowAddIntegration(true)}>
              Connect
            </Button>
          )}
        </div>

        {/* Webhook URL */}
        <div className="mt-4 rounded-md border p-3 bg-gray-50">
          <p className="text-xs font-medium text-gray-700 mb-1">Your inbound webhook URL</p>
          <p className="text-xs text-gray-500 mb-2">
            Use this URL when setting up SendGrid Inbound Parse or Postmark inbound webhooks.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border rounded px-2 py-1.5 truncate font-mono text-gray-700">
              {webhookUrl}
            </code>
            <CopyButton value={webhookUrl} />
          </div>
        </div>

        {/* Setup instructions for webhook providers */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Object.entries(WEBHOOK_SETUP).map(([key, cfg]) => (
            <div key={key} className="rounded-md border p-3 text-xs">
              <p className="font-medium text-gray-800 mb-1">{cfg.name}</p>
              <ol className="list-decimal list-inside space-y-0.5 text-gray-600">
                {cfg.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        {/* Connected integrations list */}
        {initialIntegrations.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-gray-700">Connected</p>
            {initialIntegrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{integration.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{PROVIDER_LABELS[integration.provider]}</span>
                    {integration.email && (
                      <span className="text-xs text-gray-400">{integration.email}</span>
                    )}
                    {integration.imapHost && (
                      <span className="text-xs text-gray-400">{integration.imapHost}:{integration.imapPort}</span>
                    )}
                  </div>
                  {integration.errorMessage && (
                    <p className="text-xs text-red-600 mt-0.5">{integration.errorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${STATUS_COLORS[integration.status]}`}>
                    {integration.status}
                  </Badge>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-red-600 hover:text-red-700"
                      onClick={() => handleRemoveIntegration(integration.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add integration form */}
        {canManage && showAddIntegration && (
          <div className="mt-4">
            <AddIntegrationForm
              teamId={team.id}
              onSuccess={() => {
                setShowAddIntegration(false)
                router.refresh()
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => setShowAddIntegration(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
