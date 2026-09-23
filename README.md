# Leadflow — Lead-to-Booking Dashboard

A local operations dashboard for **Harbor Home Services**, a fictional business. Combine inquiries, bookings, and completed jobs to understand conversion, response times, cancellations, lead sources, and follow-up priorities.

**All included records and results are synthetic. No real client outcomes are claimed.**

## Open the installed project

Double-click `open-dashboard.command` in this folder. Keep its Terminal window open; press Control-C to stop. Or:

```sh
cd ~/Documents/lead-to-booking-dashboard
.venv/bin/python -m streamlit run app.py
```

Open http://127.0.0.1:8501. No account, API key, model, or database server is needed. The app binds to your computer only.

## Fresh installation

Requires Python 3.11+ (3.11 used for the tested setup) and Git.

```sh
git clone https://github.com/Hasnain3201/lead-to-booking-dashboard.git
cd lead-to-booking-dashboard
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.lock.txt
python -m pip install -e . --no-deps --no-build-isolation
python -m streamlit run app.py
```

The repository starts private, so cloning requires access. `requirements.lock.txt` records the installed runtime, test, formatting, and packaging dependencies. To deliberately re-resolve later, install `.[dev]` in a fresh environment, run checks, and regenerate the lock.

## Included foundation

- Reproducible 12-week dataset: 720 inquiries, 345 bookings, 261 completed jobs.
- CSV upload with explicit contracts, normalization receipt, duplicate handling, and relationship checks.
- DuckDB SQL that aggregates to one row per inquiry before calculating metrics.
- Overview, source comparisons, unanswered inquiry queue, data quality, and a weekly brief.
- Date/source/service filters, record drill-down, and CSV/Markdown downloads.
- Meaningful metric and validation tests, Streamlit smoke tests, Ruff, and GitHub Actions.

See the [detailed implementation plan](docs/IMPLEMENTATION-PLAN.md) for remaining milestones. This foundation is runnable; it is not a completed real-business pilot or a production multi-user service.

## Verify or regenerate

```sh
source .venv/bin/activate
ruff check .
ruff format --check .
pytest -q
python scripts/generate_demo.py
```

Regeneration uses seed 42 and the fixed snapshot `2026-09-21T00:00:00Z`; it overwrites only the committed synthetic demo and deliberately invalid fixture files.

## Read next

- [Implementation plan](docs/IMPLEMENTATION-PLAN.md): phases, scope, acceptance criteria, architecture, estimates.
- [Owner requirements](docs/REQUIREMENTS.md) and [source mapping](docs/SOURCE-MAPPING.md).
- [Metric definitions](docs/METRICS.md): formulas, denominators, attribution, caveats.
- [CSV contract](docs/DATA-CONTRACT.md): exact inputs and import behavior.
- [Demo walkthrough](docs/DEMO-GUIDE.md): a short presentation and acceptance checklist.
- [Design direction](docs/DESIGN-DIRECTION.md) and [frontend prototype data](docs/FRONTEND-DATA.md).
- [Synthetic performance measurements](docs/PERFORMANCE.md).
- [Development handoff](docs/HANDOFF.md): current state, checks, next actions, usage cutoff.

No private uploads are saved by the application. Never commit real customer data. In-memory processing is not an access-control system; review privacy and hosting design before any real-data/shared deployment.
