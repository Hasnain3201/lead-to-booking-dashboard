"""Strict CSV contracts: harmless normalization is reported; ambiguity blocks import."""

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

SCHEMAS = {
    "inquiries": ["inquiry_id", "created_at", "source", "service", "first_response_at"],
    "bookings": ["booking_id", "inquiry_id", "booked_at", "scheduled_at", "status"],
    "jobs": ["job_id", "booking_id", "completed_at", "revenue_usd"],
}
DATES = {
    "inquiries": ["created_at", "first_response_at"],
    "bookings": ["booked_at", "scheduled_at"],
    "jobs": ["completed_at"],
}
SOURCES = {"google_ads", "organic_search", "referral", "social", "walk_in", "unknown"}
SERVICES = {"cleaning", "handyman", "landscaping"}
STATUSES = {"scheduled", "completed", "cancelled", "no_show"}


class DataQualityError(ValueError):
    """A bundle cannot be safely used to calculate metrics."""


@dataclass
class Bundle:
    tables: dict[str, pd.DataFrame]
    audit: pd.DataFrame
    snapshot: pd.Timestamp


def load_bundle(inputs: dict, snapshot) -> Bundle:
    snapshot = pd.Timestamp(snapshot)
    snapshot = (
        snapshot.tz_localize("UTC") if snapshot.tzinfo is None else snapshot.tz_convert("UTC")
    )
    tables, audit = {}, []
    for name, columns in SCHEMAS.items():
        if name not in inputs:
            raise DataQualityError(f"Missing {name}.csv")
        try:
            df = pd.read_csv(inputs[name], dtype=str, keep_default_na=False)
        except (ValueError, UnicodeError, pd.errors.ParserError) as exc:
            raise DataQualityError(f"{name}: could not read UTF-8 CSV ({exc})") from exc
        if list(df.columns) != columns:
            raise DataQualityError(f"{name}: columns must be {', '.join(columns)} in that order")
        raw_count = len(df)
        if raw_count > 100_000:
            raise DataQualityError(f"{name}: maximum 100,000 rows")
        stripped = df.apply(lambda col: col.str.strip())
        whitespace = int((df != stripped).any(axis=1).sum())
        df = stripped
        normalized = 0
        for col in ("source", "service", "status"):
            if col in df:
                cleaned = df[col].str.lower().str.replace(" ", "_", regex=False)
                if col == "source":
                    cleaned = cleaned.replace({"": "unknown", "google": "google_ads"})
                normalized += int((cleaned != df[col]).sum())
                df[col] = cleaned
        df = df.drop_duplicates().reset_index(drop=True)
        duplicates = raw_count - len(df)
        key = columns[0]
        if df[key].duplicated().any():
            raise DataQualityError(f"{name}: conflicting duplicate {key}; fix the source file")
        for col in columns:
            if col != "first_response_at" and df[col].eq("").any():
                raise DataQualityError(f"{name}: {col} cannot be blank")
        for col in DATES[name]:
            original = df[col]
            # Require an explicit offset: local clock values are ambiguous around DST.
            has_zone = original.str.contains(r"(?:Z|[+-]\d{2}:\d{2})$", regex=True)
            parsed = pd.to_datetime(original, utc=True, errors="coerce", format="ISO8601")
            bad = original.ne("") & (parsed.isna() | ~has_zone)
            if bad.any():
                raise DataQualityError(
                    f"{name}: {col} requires valid ISO 8601 timestamps with timezone"
                )
            df[col] = parsed
            if col != "scheduled_at" and (parsed > snapshot).any():
                raise DataQualityError(f"{name}: {col} occurs after the snapshot")
        tables[name] = df
        audit.append(
            {
                "file": f"{name}.csv",
                "input_rows": raw_count,
                "accepted_rows": len(df),
                "duplicates_removed": duplicates,
                "whitespace_rows": whitespace,
                "category_values_normalized": normalized,
            }
        )

    i, b, j = (tables[name] for name in SCHEMAS)
    for col, allowed in (("source", SOURCES), ("service", SERVICES)):
        if not i[col].isin(allowed).all():
            raise DataQualityError(
                f"inquiries: unsupported {col}; allowed: {', '.join(sorted(allowed))}"
            )
    if not b.status.isin(STATUSES).all():
        raise DataQualityError("bookings: unsupported status")
    if not b.inquiry_id.isin(i.inquiry_id).all():
        raise DataQualityError("bookings: inquiry_id does not exist in inquiries")
    if not j.booking_id.isin(b.booking_id).all():
        raise DataQualityError("jobs: booking_id does not exist in bookings")
    if j.booking_id.duplicated().any():
        raise DataQualityError("jobs: only one completed job per booking is supported")
    if (i.first_response_at < i.created_at).any():
        raise DataQualityError("inquiries: response occurs before inquiry")
    linked = b.merge(i[["inquiry_id", "created_at"]], on="inquiry_id")
    if (linked.booked_at < linked.created_at).any() or (b.scheduled_at < b.booked_at).any():
        raise DataQualityError("bookings: invalid inquiry / booking / appointment chronology")
    if (b.status.eq("no_show") & (b.scheduled_at > snapshot)).any():
        raise DataQualityError("bookings: future appointment cannot be a no-show")
    linked_jobs = j.merge(b[["booking_id", "status", "booked_at"]], on="booking_id")
    if not linked_jobs.status.eq("completed").all():
        raise DataQualityError("jobs: associated booking must have completed status")
    if (linked_jobs.completed_at < linked_jobs.booked_at).any():
        raise DataQualityError("jobs: completion occurs before booking")
    if not b.loc[b.status.eq("completed"), "booking_id"].isin(j.booking_id).all():
        raise DataQualityError("bookings: completed booking is missing its job record")
    revenue = pd.to_numeric(j.revenue_usd, errors="coerce")
    if (revenue.isna() | (revenue < 0) | (revenue == float("inf"))).any():
        raise DataQualityError("jobs: revenue_usd must be a finite nonnegative amount")
    if ((revenue * 100 - (revenue * 100).round()).abs() > 1e-6).any():
        raise DataQualityError("jobs: revenue_usd must have at most two decimal places")
    j["revenue_usd"] = revenue.astype(float)
    return Bundle(tables, pd.DataFrame(audit), snapshot)


def demo_inputs(root: Path) -> dict:
    return {name: root / "data" / "demo" / f"{name}.csv" for name in SCHEMAS}
