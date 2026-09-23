# Frontend prototype data contract

The first visual prototype should consume the validated synthetic export rather than recalculate business metrics in JavaScript. This is a static demo contract, not a deployed API or a production persistence layer.

## Generate the payload

```sh
.venv/bin/python scripts/export_demo.py --output exports/demo-dashboard.json
```

The ignored exports directory keeps generated copies out of version control. The script reads the committed synthetic manifest and three CSVs, validates them, and calls the same SQL and metric functions as the current dashboard. No customer data or network connection is involved. The generated file can feed the first visual prototype. Do not present a static export as a live or uploaded dataset.

## Version 1 shape

| Field | Meaning |
|---|---|
| schema_version | Integer contract version; currently 1 |
| synthetic | Always true for this generator |
| business | Fictional business name |
| snapshot | Common observation timestamp with UTC offset |
| reporting_timezone | UTC |
| metric_definitions | Path to the source metric definitions |
| summary | Overall inquiry-cohort metrics; rates are fractions from 0 to 1 |
| sources | Same metrics grouped by original source |
| inquiries | One row per inquiry, including response hours, outcomes, and integer revenue cents |
| bookings | One row per booking with linked source/service and optional completed-job fields |
| attention | All eligible unanswered/unbooked inquiries, ordered oldest first |
| import_receipt | Input/accepted/duplicate/normalization counts per file |
| weekly_brief | Deterministic Markdown with explicit synthetic labeling |

Missing values serialize to JSON null, never NaN. Dates use ISO timestamps. Display dollars as currency and rates as percentages, but retain integer revenue cents for reconciliation. IDs remain strings. A lead can have several bookings, so never count booking rows as unique inquiries. The complete generated payload contains all demo rows, not a hidden sample.

## Before an interactive frontend replaces Streamlit

Implement a narrow Python service for uploads, validation, filters, cohort metrics, record detail, and exports. Keep schema and formula logic in the existing Python package. Specify request-size limits, ephemeral dataset lifetime, stale-response handling, and error payloads before implementation. The browser must clear previous results when an import fails, and show the returned issue report instead. Any frontend-calculated preview requires parity tests against Python before use.

Dates select inquiry creation cohorts, not outcome periods. Preserve the weekly brief’s separate complete-week rule and disclose it in the interface. Honor reduced motion and ensure keyboard users can reach the same details as pointer-driven animations. A polished prototype is complete only when its numbers, empty states, and error states are accurate.

## Verification evidence

The export test reconciles 720 inquiries, 345 bookings, 73 follow-up rows, and total integer-cent revenue with the authoritative metrics. The latest complete suite contains 43 passing tests. This proves export consistency; it does not prove a future frontend or API works.
