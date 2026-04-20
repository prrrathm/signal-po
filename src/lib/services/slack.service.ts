export async function sendHighPriorityAlert(params: {
  confirmationId: string
  emailSubject: string
  teamId: string
  poNumber: string | null
  mismatches: { type: string; severity: string; description: string }[]
}): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  const { confirmationId, emailSubject, teamId, poNumber, mismatches } = params

  const mismatchLines = mismatches.length > 0
    ? mismatches.map(m => `• [${m.severity}] ${m.type}: ${m.description}`).join('\n')
    : '• No specific mismatches recorded'

  const payload = {
    text: `:rotating_light: High Priority Flag: ${emailSubject}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: ':rotating_light: High Priority Flag' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Subject:*\n${emailSubject}` },
          { type: 'mrkdwn', text: `*PO Number:*\n${poNumber ?? 'Unknown'}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Mismatches:*\n${mismatchLines}` },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Confirmation ID: \`${confirmationId}\` | Team: \`${teamId}\``,
          },
        ],
      },
    ],
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}: ${await response.text()}`)
  }
}
