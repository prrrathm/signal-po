/**
 * Strip quoted reply content from an email body.
 *
 * Supplier confirmation emails often contain long quoted threads from the
 * original PO. We only want the new content the supplier wrote.
 */

// Patterns that mark the start of a quoted section
const QUOTE_MARKERS = [
  // "On Mon, 1 Jan 2024, John wrote:"
  /^On .{10,80} wrote:\s*$/m,
  // "> quoted text"
  /^>[ \t].*/m,
  // "----- Original Message -----" / "--- Forwarded message ---"
  /^-{2,}\s*(original message|forwarded message|begin forwarded|reply|from:)\s*-{2,}/im,
  // "From: " preceded by blank line (common Outlook threading)
  /^\s*From:\s+\S+@\S+/m,
  // Outlook-style "________"
  /^_{5,}\s*$/m,
]

function findFirstQuotePosition(text: string): number {
  let earliest = text.length
  for (const pattern of QUOTE_MARKERS) {
    const match = pattern.exec(text)
    if (match && match.index < earliest) {
      earliest = match.index
    }
  }
  return earliest
}

export function stripQuotedReplies(body: string): string {
  const cutAt = findFirstQuotePosition(body)
  const trimmed = body.slice(0, cutAt).trimEnd()
  // If we stripped more than 80% of the content, the body is probably all
  // quoted — return the original rather than a useless stub.
  if (trimmed.length < body.length * 0.2 && trimmed.length < 200) {
    return body.trim()
  }
  return trimmed || body.trim()
}
