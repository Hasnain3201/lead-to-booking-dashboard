# Synthetic pipeline benchmark

Measured September 23, 2026, using `scripts/benchmark.py`. Each independent process creates three in-memory CSVs, validates them, runs the inquiry-cohort SQL, and reconciles counts plus integer-cent revenue. Input generation is outside the timed region. No production data or network services are used.

| Rows per table | Total rows | Validation | SQL + metrics | Total | Peak process RSS |
|---|---|---|---|---|---|
| 10,000 | 30,000 | 0.106s | 0.052s | 0.158s | 149.1 MB |
| 100,000 | 300,000 | 0.822s | 0.113s | 0.935s | 364.3 MB |

Environment: macOS arm64, Python 3.11.14, pandas 2.3.3, DuckDB 1.5.5. One run per size; results are observations, not guarantees or a rigorous comparative benchmark. Peak RSS includes Python, libraries, generated CSV buffers, and results, not just incremental pipeline memory.

The 100,000-row inquiry and booking files exceed the UI’s 5 MB-per-file upload limit. That run exercises the library’s 100,000-row-per-table limit directly; it does not claim those files can be uploaded through the current UI. No charts, browser interactions, upload transfer, or concurrent users are included.

Reproduce from the repository root:

```sh
.venv/bin/python scripts/benchmark.py --rows 10000
.venv/bin/python scripts/benchmark.py --rows 100000
```
