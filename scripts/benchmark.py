"""Measure a synthetic in-memory import and SQL pass; not a browser performance claim."""

import argparse
import json
import platform
import resource
import sys
from io import StringIO
from pathlib import Path
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import duckdb  # noqa: E402
import pandas as pd  # noqa: E402

from leadflow.analytics import cohort_table, metrics  # noqa: E402
from leadflow.data import load_bundle  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, choices=[10_000, 100_000], required=True)
    args = parser.parse_args()
    n = args.rows
    inputs = {
        "inquiries": StringIO(
            "inquiry_id,created_at,source,service,first_response_at\n"
            + "".join(
                f"I{i},2026-09-01T08:00:00Z,referral,cleaning,2026-09-01T09:00:00Z\n"
                for i in range(n)
            )
        ),
        "bookings": StringIO(
            "booking_id,inquiry_id,booked_at,scheduled_at,status\n"
            + "".join(
                f"B{i},I{i},2026-09-01T10:00:00Z,2026-09-02T10:00:00Z,completed\n" for i in range(n)
            )
        ),
        "jobs": StringIO(
            "job_id,booking_id,completed_at,revenue_usd\n"
            + "".join(f"J{i},B{i},2026-09-02T12:00:00Z,123.45\n" for i in range(n))
        ),
    }
    sizes = {name: len(value.getvalue().encode()) for name, value in inputs.items()}
    start = perf_counter()
    bundle = load_bundle(inputs, "2026-09-03T00:00:00Z")
    imported = perf_counter()
    cohort = cohort_table(bundle, ROOT / "sql/cohort.sql")
    result = metrics(cohort)
    finished = perf_counter()
    assert result["inquiries"] == result["bookings"] == result["completed_jobs"] == n
    assert result["conversion"] == 1.0
    assert cohort.revenue_cents.sum() == n * 12345
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak_mb = peak / (1024 * 1024 if sys.platform == "darwin" else 1024)
    print(
        json.dumps(
            {
                "rows_per_table": n,
                "total_rows": n * 3,
                "csv_bytes": sizes,
                "validation_seconds": round(imported - start, 3),
                "sql_and_metrics_seconds": round(finished - imported, 3),
                "total_seconds": round(finished - start, 3),
                "peak_process_rss_mb": round(peak_mb, 1),
                "platform": platform.platform(),
                "processor": platform.machine(),
                "python": platform.python_version(),
                "pandas": pd.__version__,
                "duckdb": duckdb.__version__,
                "reconciliation": "passed",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
