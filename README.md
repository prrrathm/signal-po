# Signal PO

A Purchase Order (PO) Confirmation Triage System. Suppliers send confirmation emails; the system uses AI to extract structured data from those emails, compares it against expected PO values, and surfaces discrepancies for human review.

---

## How It Works

```
Email Input → Store + Enqueue → Worker → LLM Extraction → PO Match → Compare → Save → UI Display → User Action
```

### Step-by-step

1. **Email Ingestion** (`POST /api/emails`)
   - User pastes a supplier email (subject + body) into the web form
   - Email stored in `emails` table (status: `pending`)
   - A job created in `jobs` table (status: `pending`)

2. **Worker Processing** (`POST /api/worker`)
   - Triggered automatically after ingestion
   - Picks the oldest pending job, marks it `processing`

3. **LLM Extraction** (`src/lib/llm/extract.ts`)
   - Calls OpenRouter (Llama 3.3 70B) with the email text
   - Extracts: `po_number`, `confirmed_qty`, `delivery_date`, `unit_price`, `currency`, `confidence`
   - Falls back to nulls if parsing fails

4. **PO Matching** (`src/lib/services/po.service.ts`)
   - Looks up the extracted `po_number` in the `purchase_orders` table

5. **Comparison Logic** (`src/lib/services/comparison.service.ts`)
   - Qty: flags if confirmed < expected (HIGH severity if >20% short)
   - Date: flags if >3 days late (HIGH if >14 days)
   - Price: flags if >5% deviation (HIGH if >15%)
   - No match found: `unmatched` status, HIGH severity

6. **Data Saved**
   - `parsed_confirmations` record created with status: `matched`, `needs_review`, `high_priority_flag`, or `unmatched`
   - Each mismatch saved to `mismatches` table
   - Audit log written; job and email marked `completed`/`processed`

7. **UI Display** (`src/components/action-center-table.tsx`)
   - Dashboard polls `/api/confirmations` every 10 seconds
   - Table with filter tabs: All / High Priority / Needs Review / Matched / Unmatched
   - Shows PO number, supplier, status badge, mismatch flags, confidence %, confirmed values

8. **User Actions**
   - **Approve** — marks resolved
   - **Snooze** — hides for 24 hours
   - **Resolve** — acknowledges without full approval
   - All actions hit `POST /api/confirmations/[id]/action` and are logged to the audit table

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Database | Postgres + Drizzle ORM |
| Auth | Custom HMAC session (bcrypt passwords, HttpOnly cookie) |
| AI | OpenRouter API — Llama 3.3 70B |
| Queue | DB-backed jobs table (no external queue library) |
| UI | shadcn/ui + TailwindCSS + TanStack Table |

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` / `sessions` | Authentication |
| `purchase_orders` | Expected PO data (qty, price, delivery date) |
| `emails` | Raw ingested emails |
| `jobs` | Processing queue |
| `parsed_confirmations` | LLM extraction results + comparison status |
| `mismatches` | Individual discrepancies per confirmation |
| `audit_logs` | Full action history |

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/emails` | GET | List all emails |
| `/api/emails` | POST | Ingest new email, enqueue job |
| `/api/worker` | POST | Process next pending job |
| `/api/confirmations` | GET | List all confirmations with mismatches |
| `/api/confirmations/[id]` | GET | Get single confirmation |
| `/api/confirmations/[id]/action` | POST | Approve / snooze / resolve |
| `/api/purchase-orders` | GET/POST | PO CRUD |
| `/api/seed` | POST | Load mock POs and emails for testing |
| `/api/auth/login` | POST | Authenticate user |
| `/api/auth/logout` | POST | Destroy session |

---

## Setup

### Prerequisites

- Node.js 18+
- Postgres database
- OpenRouter API key (free tier works)

### Environment variables

```env
DATABASE_URL=postgres://...
OPENROUTER_API_KEY=sk-or-...
AUTH_SECRET=any-long-random-string
```

### Install and run

```bash
bun install
bun run db:migrate
bun run dev
```

### Load test data

```bash
curl -X POST http://localhost:3000/api/seed
```

This creates 3 mock purchase orders and 5 sample supplier emails ready to process.

---

## Comparison Rules

| Field | Threshold | Severity |
|---|---|---|
| Quantity | Confirmed < Expected | MEDIUM |
| Quantity | Short by >20% | HIGH |
| Delivery date | >3 days late | MEDIUM |
| Delivery date | >14 days late | HIGH |
| Unit price | >5% deviation | MEDIUM |
| Unit price | >15% deviation | HIGH |
| PO number | Not found in DB | HIGH (unmatched) |

Status is determined by the worst mismatch: no mismatches → `matched`; any HIGH → `high_priority_flag`; all MEDIUM/LOW → `needs_review`.

---

## Known Gaps

- No real job queue — worker is triggered manually (no retries, no backoff)
- No email integration — copy-paste only (no Gmail/Outlook/IMAP)
- No PDF or attachment parsing
- No notification system (Slack/email alerts for high-priority flags)
- Audit logs exist in DB but are not surfaced in the UI
- No duplicate detection (forwarding the same email twice creates two confirmations)
