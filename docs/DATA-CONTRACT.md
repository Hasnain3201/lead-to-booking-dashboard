# CSV contract

Provide one UTF-8 file per entity, with exactly these ordered column headers. All three files must describe the same snapshot and business. Use anonymized identifiers; v1 needs no names, email addresses, phone numbers, addresses, or documents.

## Inquiries

`inquiry_id,created_at,source,service,first_response_at`

- One row per inquiry. `inquiry_id` is a nonempty unique string.
- `created_at`: required ISO 8601 timestamp with explicit UTC `Z` or `+/-HH:MM` offset.
- `source`: `google_ads`, `organic_search`, `referral`, `social`, `walk_in`, or `unknown`.
- `service`: `cleaning`, `handyman`, or `landscaping`.
- `first_response_at`: timestamp in the same format, or blank if unrecorded. Must be on/after creation and on/before snapshot.

## Bookings

`booking_id,inquiry_id,booked_at,scheduled_at,status`

- One row per booking. `booking_id` is unique; `inquiry_id` must exist. Multiple bookings per inquiry are supported.
- `booked_at` must be on/after inquiry creation and on/before snapshot.
- `scheduled_at` must be on/after booking; future scheduled appointments are permitted.
- `status`: `scheduled`, `completed`, `cancelled`, or `no_show`. No-shows cannot have future appointments.
- A reschedule updates its existing booking's appointment time; a genuinely new booking gets a new ID. V1 does not retain schedule history.

## Completed jobs

`job_id,booking_id,completed_at,revenue_usd`

- One row per completed booking; both `job_id` and `booking_id` must be unique.
- The referenced booking must exist with `completed` status. Every completed booking must have a matching job.
- `completed_at`: on/after booking and on/before snapshot. It may differ from the scheduled date.
- `revenue_usd`: finite nonnegative numeric amount with at most two decimal places; no currency symbols or thousands separators. Refunds and partial jobs require a later contract extension.

## Import behavior

Trim surrounding whitespace; normalize category case and spaces; map `Google` to `google_ads` and blank source to `unknown`. Remove fully identical rows after normalization. Show counts in the import receipt. Never guess IDs, timestamps, responses, revenue, or relationships. Conflicting IDs, malformed timestamps, missing columns, extra columns, invalid status or category values, orphan records, and chronology contradictions block the entire bundle with an actionable error. Header-only tables are accepted. No partial dashboard is shown for an invalid bundle.

Limits: 5 MB per file in the UI, and 100,000 rows per table. These are guardrails, not a performance benchmark. Uploads are processed in memory, without database persistence or application-level saving. Temporary Python objects live for the session; no claim of secure erasure is made. CSV downloads neutralize formula-like text cells.

Demo provenance: deterministic Python random seed 42; 720 inquiries over June 29–September 20, 2026, with outcomes through September 21, 2026 00:00 UTC. Patterns are deliberately constructed, not representative market findings. Three duplicate inquiries and occasional source aliases/whitespace demonstrate cleanup. `data/invalid/bookings_orphan.csv` is a complete alternate bookings file with one deliberate orphan, for demonstrating rejection alongside the two regular demo files.
