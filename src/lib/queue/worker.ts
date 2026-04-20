import { db } from '@/db'
import { jobs, emails, attachments } from '@/db/schema'
import { eq, and, or, isNull, lte, sql } from 'drizzle-orm'
import { extractEmailData } from '../services/extraction.service'
import { findPoByNumber } from '../services/po.service'
import { compareWithPo } from '../services/comparison.service'
import { saveConfirmation } from '../services/confirmation.service'
import { updateEmailStatus } from '../services/email.service'
import { logAudit } from '../services/audit.service'
import { getFile } from '../services/storage.service'
import { extractTextFromAttachment } from '../attachments'
import { sendHighPriorityAlert } from '../services/slack.service'

export interface WorkerResult {
  processed: boolean
  jobId?: string
  confirmationId?: string
  error?: string
}

export async function processNextJob(teamId: string): Promise<WorkerResult> {
  // Pick the oldest pending job belonging to this team that is eligible to run
  // (either no retryAfter set, or retryAfter has passed)
  const [pending] = await db
    .select({ id: jobs.id, emailId: jobs.emailId, retryCount: jobs.retryCount, maxRetries: jobs.maxRetries })
    .from(jobs)
    .innerJoin(emails, eq(jobs.emailId, emails.id))
    .where(
      and(
        eq(jobs.status, 'pending'),
        eq(emails.teamId, teamId),
        or(isNull(jobs.retryAfter), lte(jobs.retryAfter, sql`now()`))
      )
    )
    .orderBy(jobs.createdAt)
    .limit(1)

  if (!pending) return { processed: false }

  const jobId = pending.id
  const emailId = pending.emailId

  // Claim it
  await db
    .update(jobs)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(jobs.id, jobId))

  try {
    await updateEmailStatus(emailId, 'processing')

    const [email] = await db.select().from(emails).where(eq(emails.id, emailId))
    if (!email) throw new Error(`Email ${emailId} not found`)

    // Extract attachment texts before LLM call
    const pendingAttachments = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.emailId, emailId), eq(attachments.status, 'pending')))

    const attachmentTexts: string[] = []
    for (const att of pendingAttachments) {
      await db
        .update(attachments)
        .set({ status: 'processing' })
        .where(eq(attachments.id, att.id))

      try {
        const buffer = await getFile(att.storageKey)
        const text = await extractTextFromAttachment(buffer, att.mimeType, att.filename)
        await db
          .update(attachments)
          .set({ extractedText: text, status: 'done' })
          .where(eq(attachments.id, att.id))
        attachmentTexts.push(`--- ATTACHMENT: ${att.filename} ---\n${text}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await db
          .update(attachments)
          .set({ status: 'failed' })
          .where(eq(attachments.id, att.id))
        // Non-fatal: log and continue with remaining attachments
        console.error(`Attachment extraction failed for ${att.filename}: ${msg}`)
      }
    }

    // 1. Extract via LLM (email body + attachment texts)
    const extraction = await extractEmailData(email.subject, email.body, attachmentTexts)

    // 2. Match PO (scoped to the team)
    const po = extraction.po_number ? await findPoByNumber(extraction.po_number, teamId) : null

    // 3. Compare
    const comparison = compareWithPo(extraction, po)

    // 4. Persist
    const confirmationId = await saveConfirmation({
      emailId,
      poId: po?.id ?? null,
      extraction,
      comparison,
    })

    // 5. Audit
    await logAudit(
      'email',
      emailId,
      'email.processed',
      { confirmationId, status: comparison.status, mismatchCount: comparison.mismatches.length },
      teamId
    )

    // 6. Slack alert for high-priority flags (fire-and-forget — never fails the job)
    if (comparison.status === 'high_priority_flag') {
      sendHighPriorityAlert({
        confirmationId,
        emailSubject: email.subject,
        teamId,
        poNumber: extraction.po_number ?? null,
        mismatches: comparison.mismatches,
      }).catch(err => console.error('Slack alert failed (non-fatal):', err))
    }

    await db
      .update(jobs)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(jobs.id, jobId))

    await updateEmailStatus(emailId, 'processed')

    return { processed: true, jobId, confirmationId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const newRetryCount = pending.retryCount + 1

    if (newRetryCount >= pending.maxRetries) {
      // Exhausted all retries — dead-letter the job
      await db
        .update(jobs)
        .set({ status: 'dead_lettered', error: message, retryCount: newRetryCount, updatedAt: new Date() })
        .where(eq(jobs.id, jobId))
      await updateEmailStatus(emailId, 'failed')
      await logAudit('email', emailId, 'email.dead_lettered', { error: message, retryCount: newRetryCount }, teamId)
    } else {
      // Schedule retry with exponential backoff: 30s → 60s → 120s
      const backoffMs = 30_000 * Math.pow(2, pending.retryCount)
      const retryAfter = new Date(Date.now() + backoffMs)
      await db
        .update(jobs)
        .set({ status: 'pending', error: message, retryCount: newRetryCount, retryAfter, updatedAt: new Date() })
        .where(eq(jobs.id, jobId))
      await logAudit(
        'email',
        emailId,
        'email.retry_scheduled',
        { error: message, retryCount: newRetryCount, retryAfter },
        teamId
      )
      // Leave email status as 'pending' — it will be re-attempted
    }

    return { processed: true, jobId, error: message }
  }
}
