# Frontend data contract

The React interface in `frontend/` never calculates business metrics. It calls a local Starlette API (`src/leadflow/api.py`) that wraps the same tested functions used by the Streamlit view and the test suite. `python serve.py` runs the API and the built interface together at http://127.0.0.1:8765.

## Endpoints

| Method and path | Returns |
|---|---|
| `GET /api/datasets/{id}` | Workspace label, sample flag, snapshot, available sources and services, first/last inquiry dates, inquiry count, import receipt, and whether uploads are enabled |
| `GET /api/datasets/{id}/view` | Everything for one filtered view: `metrics`, `sources`, `flow`, `inquiries`, `timeline`, `attention`, `failed_bookings`, and `brief` |
| `GET /api/datasets/{id}/inquiries/{inquiry_id}` | One inquiry with its furthest outcome, and every booking and completed job it has |
| `GET /api/datasets/{id}/exports/{kind}` | `follow-up.csv`, `booking-outcomes.csv`, `source-metrics.csv`, `inquiries.csv`, `import-receipt.csv`, or `weekly-brief.md`, using the same filters as the view |
| `GET /api/samples/{name}` | The committed sample CSVs, plus `bookings_orphan.csv` for demonstrating a failed import |
| `POST /api/datasets` | Multipart `inquiries`, `bookings`, `jobs` files and a `snapshot` date. Returns `201 {id}` or `422 {issue_count, issues}` |

The dataset `demo` is always available. Uploaded datasets receive random IDs, live in memory only, and are evicted after the four most recent uploads.

## Filters

`view` and `exports` accept `start` and `end` (inclusive UTC dates, `YYYY-MM-DD`), plus comma-separated `sources` and `services`. An omitted list means all values; an empty list means none, which returns an empty cohort with `null` rates rather than an error. Invalid or reversed dates return `400`.

Date filters select inquiry creation cohorts. The `timeline` and `brief` deliberately ignore the date range but honor source and service filters, so the whole period stays visible for selection and the brief's two comparison weeks stay complete.

## Field notes

- Rates are fractions from 0 to 1; missing values are JSON `null`, never NaN.
- `revenue_cents` is an exact integer; `revenue_usd` is for display only.
- `inquiries[].outcome` is the furthest outcome: `completed`, `scheduled`, `lost` (cancelled or no-show only), or `unbooked`. `flow` counts the same paths by source and response status, so its totals equal the inquiry count.
- IDs are strings. A lead can have several bookings, so booking rows are never counted as inquiries.

## Upload safety

Uploads require `Content-Length`, are limited to 5 MB per file (matching the CSV contract), and are parsed with an in-memory multipart parser, so files are never spooled to temporary disk. A failed import returns the full issue report and creates no dataset. The interface then clears every metric and shows the issues until a valid bundle is imported or the user returns to the demo. Set `LEADFLOW_DISABLE_UPLOADS=1` before any public deployment.

## Static export

`scripts/export_demo.py --output exports/demo-dashboard.json` still produces a single validated JSON snapshot of the sample workspace for offline experiments. It is not used by the interface.

## Verification

`tests/test_api.py` reconciles the API with authoritative totals (720 inquiries, 345 bookings, 261 jobs, 73 follow-ups, exact cents, and flow totals equal to inquiries). It also covers filter narrowing, empty selections, invalid dates, repeat-booking detail, export and view parity, successful and failed uploads, missing files, disabled uploads, and unknown datasets and samples.
