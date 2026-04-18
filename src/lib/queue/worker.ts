import { db } from '@/db'
import { jobs, emails } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { extractEmailData } from '../services/extraction.service'
import { findPoByNumber } from '../services/po.service'
import { compareWithPo } from '../services/comparison.service'
import { saveConfirmation } from '../services/confirmation.service'
import { updateEmailStatus } from '../services/email.service'
import { logAudit } from '../services/audit.service'

export interface WorkerResult {
  processed: boolean
  jobId?: string
  confirmationId?: string
  error?: string
}

export async function processNextJob(): Promise<WorkerResult> {
  // Pick the oldest pending job
  const [pending] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, 'pending'))
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

    // 1. Extract via Claude
    const extraction = await extractEmailData(email.subject, email.body)

    // 2. Match PO
    const po = extraction.po_number ? await findPoByNumber(extraction.po_number) : null

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
    await logAudit('email', emailId, 'email.processed', {
      confirmationId,
      status: comparison.status,
      mismatchCount: comparison.mismatches.length,
    })

    await db
      .update(jobs)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(jobs.id, jobId))

    await updateEmailStatus(emailId, 'processed')

    return { processed: true, jobId, confirmationId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    await db
      .update(jobs)
      .set({ status: 'failed', error: message, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))

    await updateEmailStatus(emailId, 'failed')
    await logAudit('email', emailId, 'email.processing_failed', { error: message })

    return { processed: true, jobId, error: message }
  }
}
