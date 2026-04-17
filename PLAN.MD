## 1) Problem statement

Businesses receive supplier emails about purchase orders, but the information is usually** ** **unstructured, incomplete, and inconsistent** . A single PO confirmation email may contain the PO number, quantity, delivery date, and price in free text, often with variations like “confirmed,” “partially available,” “delayed,” or “price updated.”

The real problem is not just extracting data. The hard part is** ** **deciding whether the confirmation matches the original PO and whether it needs human attention** .

This is big, consistent, and hard to solve because:

* Email is the default communication layer in many operations-heavy businesses.
* The same PO can have multiple replies and follow-ups across a thread.
* Supplier responses are messy: missing fields, ambiguous language, attachments, and partial confirmations.
* The business impact is real: delayed shipments, quantity mismatches, price deviations, and missed escalations can directly affect inventory, cash flow, and customer delivery.
* Simple rule-based parsers fail because the input is not standardized, and pure LLM extraction is not enough because the system must be reliable, auditable, and actionable.

So the product is really a** ** **decision-support system for PO confirmation triage** .

For a weekend project, your scope should be:
**“Read supplier confirmation emails, extract key PO fields, compare them with expected PO data, flag mismatches, and show them in an action center.”**

That is enough to communicate the core value.

---

## 2) System Design Requirements

### Functional requirements

* Ingest supplier emails from a mock inbox or uploaded text/email files.
* Extract structured fields from each email:
  * PO number
  * supplier name
  * confirmed quantity
  * delivery date
  * price
  * any notes or exceptions
* Match the email to an expected PO record in the database.
* Compare expected vs confirmed values.
* Flag mismatches such as:
  * quantity mismatch
  * delivery delay beyond threshold
  * price deviation beyond threshold
  * missing or uncertain fields
* Store extracted data, comparison results, and audit history.
* Show an action center UI with:
  * pending confirmations
  * flagged mismatches
  * approve / snooze / mark resolved actions
* Keep a basic log of each processing step.

### Non-functional requirements

* Fast enough for a small batch of emails.
* Reliable parsing with graceful failure when extraction is incomplete.
* Idempotent processing so the same email is not handled twice.
* Traceability through audit logs.
* Simple and maintainable architecture for a solo weekend build.
* Minimal operational complexity.
* Safe fallback when the LLM returns low-confidence or malformed output.

For a weekend build, do** ****not** try to support:

* real Gmail OAuth
* multi-user permissions
* advanced queue infrastructure
* attachment OCR
* threaded conversation understanding
* complex approval workflows

Those are good later, but they will blow up scope.

---

## 3) System Design

### Recommended tech stack

Since you want to finish fast:

**Frontend**

* Next.js
* Tailwind CSS
* shadcn/ui for cards, tables, dialogs, badges
* TanStack Table for the action center grid

**Backend**

* Next.js route handlers or server actions
* PostgreSQL via Supabase
* Prisma or Drizzle ORM, whichever you are faster with

**LLM layer**

* OpenAI or Claude API
* Force structured output / JSON schema extraction

**Email ingestion**

* Weekend version: mock inbox with seeded email text in the database or a simple upload textbox
* Optional upgrade: Gmail API later

**Job processing**

* For weekend scope, use a simple background endpoint or server-side processing flow
* No queue needed unless you already know BullMQ well

---

### Pipeline

#### Step 1: Ingest email

Take raw supplier email content and store it in a table like** **`emails`.

Fields:

* id
* supplier_id
* subject
* body
* received_at
* status

#### Step 2: Extract structured data

Send the raw email to the LLM with a strict schema prompt.

Return JSON like:

* po_number
* confirmed_qty
* delivery_date
* unit_price
* currency
* extracted_notes
* confidence

If the model cannot confidently find a field, return** **`null` and a low confidence score.

#### Step 3: Match PO

Look up the PO in your** **`purchase_orders` table using PO number.

If no match exists:

* mark as “unmatched”
* send to review queue

#### Step 4: Compare against expected values

Compute mismatch rules in code:

* quantity mismatch if confirmed_qty < expected_qty
* date slipped if confirmed delivery date > expected date + 3 days
* price deviation if abs(confirmed_price - expected_price) / expected_price > 5%

Assign a status:

* `matched`
* `needs_review`
* `high_priority_flag`

#### Step 5: Persist results

Store:

* extracted fields
* comparison result
* mismatch reasons
* confidence score
* raw email reference
* audit trail entries

#### Step 6: Action Center UI

Show:

* PO number
* supplier
* status
* flags
* confidence
* suggested action
* timestamps

Actions:

* approve
* snooze
* mark resolved

That UI is the part that makes it feel like a product instead of a parser.

---

### Minimal database model

You only need a few tables:

**purchase_orders**

* id
* po_number
* supplier_name
* expected_qty
* expected_delivery_date
* expected_unit_price
* status

**emails**

* id
* subject
* body
* received_at
* supplier_name
* status

**parsed_confirmations**

* id
* email_id
* po_id
* confirmed_qty
* confirmed_delivery_date
* confirmed_unit_price
* confidence
* raw_json

**mismatches**

* id
* parsed_confirmation_id
* type
* severity
* description
* resolved

**audit_logs**

* id
* entity_type
* entity_id
* action
* metadata
* created_at
