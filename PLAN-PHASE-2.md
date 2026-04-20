# Phase 2 Gap Analysis

Beyond auth and email connectivity, here's an honest gap analysis grouped by priority.

---

## High Impact / Near-Term

### Authentication & Multi-Tenancy

- Login, session management, org/team isolation
- Role-based access: admin, reviewer, read-only
- Per-user action history

### Email Service Integration

- Gmail OAuth + IMAP polling or push (Gmail Pub/Sub)
- Outlook / Office 365 (Microsoft Graph API)
- Generic IMAP for any mailbox
- Inbound webhook (SendGrid, Postmark) for forwarded emails

### PO Import

- Right now POs only come in via `POST /api/purchase-orders` or seed data. Real users need CSV/Excel upload, or ERP sync (SAP, NetSuite, QuickBooks)

### Attachment Handling

- Supplier confirmations often arrive as PDF or Excel attachments, not plain text. No OCR or PDF parsing exists yet

---

## Medium Priority

### Notifications & Alerting

- Email/Slack alert when a high-priority flag is created
- Daily digest of unresolved items
- Escalation: auto-flag if unresolved after N days

### Manual Extraction Override

- If Claude extracts the wrong PO number or price, there's no way to correct it without going to the DB directly. Users need an edit form

### Supplier Management

- A suppliers table with canonical names, aliases, and contact info
- Right now supplier name is a free text field on both PO and email, so "Acme Ltd" vs "ACME COMPONENTS LTD" won't match

### Email Thread Awareness

- Multiple emails about the same PO (initial confirmation, amendment, follow-up) are treated as independent. The system needs to group them by PO number and track the latest state

---

## Lower Priority

### Reporting & Analytics

- Supplier reliability scores (how often do they match vs flag?)
- Resolution time metrics
- Mismatch trends over time

### Outbound Webhooks / ERP Sync

- When a confirmation is approved, push the result back to the ERP or notify a downstream system

### Real Job Queue

- The simulated jobs table works but has no retry logic, no dead-letter queue, no concurrency control. Inngest or BullMQ would replace this cleanly

### Audit Log UI

- The `audit_logs` table exists but nothing surfaces it in the UI

### Duplicate Detection

- The same email forwarded twice will create two jobs and two confirmations for the same PO. Idempotency key needed

---

## Summary

| Feature | Effort | Business Impact |
|---|---|---|
| Auth (NextAuth/Clerk) | Medium | Required for production |
| Gmail/Outlook OAuth | High | Core value prop |
| CSV PO import | Low | Immediate usability |
| Notifications (Slack/email) | Low | High operational value |
| PDF/attachment parsing | High | Covers most real emails |
| Manual extraction edit | Low | Trust & accuracy |
| Supplier name normalization | Low | Matching reliability |
| Email thread grouping | Medium | Correctness |
| Real job queue (Inngest) | Low | Reliability at scale |
| Reporting dashboard | Medium | Stakeholder visibility |

The two to prioritize first after auth: **CSV PO import** (zero friction to get real data in) and **manual extraction override** (builds user trust when Claude gets something wrong).
