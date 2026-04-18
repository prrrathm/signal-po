 Beyond auth and email connectivity, here's a honest gap analysis
  grouped by priority:

---

  High impact / near-term

  Authentication & multi-tenancy (you flagged this)

- Login, session management, org/team isolation
- Role-based access: admin, reviewer, read-only
- Per-user action history

  Email service integration (you flagged this)

- Gmail OAuth + IMAP polling or push (Gmail Pub/Sub)
- Outlook / Office 365 (Microsoft Graph API)
- Generic IMAP for any mailbox
- Inbound webhook (SendGrid, Postmark) for forwarded emails

  PO import

- Right now POs only come in via POST /api/purchase-orders or seed
  data. Real users need CSV/Excel upload, or ERP sync (SAP, NetSuite,
  QuickBooks)

  Attachment handling

- Supplier confirmations often arrive as PDF or Excel attachments,
  not plain text. No OCR or PDF parsing exists yet

---

  Medium priority

  Notifications & alerting

- Email/Slack alert when a high-priority flag is created
- Daily digest of unresolved items
- Escalation: auto-flag if unresolved after N days

  Manual extraction override

- If Claude extracts the wrong PO number or price, there's no way
  to correct it without going to the DB directly. Users need an edit
  form

  Supplier management

- A suppliers table with canonical names, aliases, and contact info
- Right now supplier name is a free text field on both PO and
  email, so "Acme Ltd" vs "ACME COMPONENTS LTD" won't match

  Email thread awareness

- Multiple emails about the same PO (initial confirmation,
  amendment, follow-up) are treated as independent. The system needs
  to group them by PO number and track the latest state

---

  Lower priority but notable gaps

  Reporting & analytics

- Supplier reliability scores (how often do they match vs flag?)
- Resolution time metrics
- Mismatch trends over time

  Outbound webhooks / ERP sync

- When a confirmation is approved, push the result back to the ERP
  or notify a downstream system

  Real job queue

- The simulated jobs table works but has no retry logic, no
  dead-letter queue, no concurrency control. Inngest or BullMQ would
  replace this cleanly

  Audit log UI

- The audit_logs table exists but nothing surfaces it in the UI

  Duplicate detection

- The same email forwarded twice will create two jobs and two
  confirmations for the same PO. Idempotency key needed

---

  Summary table

  ┌────────────────────────────┬────────┬────────────────────────┐
  │          Feature           │ Effort │    Business impact     │
  ├────────────────────────────┼────────┼────────────────────────┤
  │ Auth (NextAuth/Clerk)      │ Medium │ Required for           │
  │                            │        │ production             │
  ├────────────────────────────┼────────┼────────────────────────┤
  │ Gmail/Outlook OAuth        │ High   │ Core value prop        │
  ├────────────────────────────┼────────┼────────────────────────┤
  │ CSV PO import              │ Low    │ Immediate usability    │
  ├────────────────────────────┼────────┼────────────────────────┤
  │ Notifications              │ Low    │ High operational value │
  │ (Slack/email)              │        │                        │
  ├────────────────────────────┼────────┼────────────────────────┤
  │ PDF/attachment parsing     │ High   │ Covers most real       │
  │                            │        │ emails                 │
  ├────────────────────────────┼────────┼────────────────────────┤
  │ Manual extraction edit     │ Low    │ Trust & accuracy       │
  ├────────────────────────────┼────────┼────────────────────────┤
  │ Supplier name              │ Low    │ Matching reliability   │
  │ normalization              │        │                        │
  ├────────────────────────────┼────────┼────────────────────────┤
  │ Email thread grouping      │ Medium │ Correctness            │
  ├────────────────────────────┼────────┼────────────────────────┤
  │ Real job queue (Inngest)   │ Low    │ Reliability at scale   │
  ├────────────────────────────┼────────┼────────────────────────┤
  │ Reporting dashboard        │ Medium │ Stakeholder visibility │
  └────────────────────────────┴────────┴────────────────────────┘

  The two I'd prioritize first after auth: CSV PO import (zero
  friction to get real data in) and manual extraction override
  (builds user trust when Claude gets something wrong).
