"""Export validated synthetic data for a frontend prototype; no separate metric definitions."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from leadflow.analytics import (  # noqa: E402
    attention_queue,
    booking_details,
    cohort_table,
    metrics,
    source_metrics,
    weekly_summary,
)
from leadflow.data import demo_inputs, load_bundle  # noqa: E402


def records(frame):
    return json.loads(frame.to_json(orient="records", date_format="iso"))


def build_demo():
    manifest = json.loads((ROOT / "data/demo/manifest.json").read_text())
    bundle = load_bundle(demo_inputs(ROOT), manifest["snapshot"])
    cohort = cohort_table(bundle, ROOT / "sql/cohort.sql")
    return {
        "schema_version": 1,
        "synthetic": True,
        "business": manifest["business"],
        "snapshot": bundle.snapshot.isoformat(),
        "reporting_timezone": "UTC",
        "metric_definitions": "docs/METRICS.md",
        "summary": metrics(cohort),
        "sources": records(source_metrics(cohort)),
        "inquiries": records(cohort),
        "bookings": records(booking_details(bundle, cohort)),
        "attention": records(attention_queue(cohort, bundle.snapshot)),
        "import_receipt": records(bundle.audit),
        "weekly_brief": weekly_summary(cohort, bundle.snapshot, synthetic=True),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    payload = build_demo()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, allow_nan=False) + "\n")
    print(f"Exported {len(payload['inquiries'])} synthetic inquiries to {args.output}")


if __name__ == "__main__":
    main()
