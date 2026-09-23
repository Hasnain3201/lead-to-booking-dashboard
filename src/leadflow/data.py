"""Strict CSV contracts with actionable, bounded issue reports."""

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
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
ISSUE_COLUMNS = ["file", "row", "column", "code", "issue", "repair"]
MAX_REPORTED_ISSUES = 200


class DataQualityError(ValueError):
    """A bundle cannot be safely used to calculate metrics."""

    def __init__(self, issues, total=None):
        self.issues = pd.DataFrame(issues, columns=ISSUE_COLUMNS)
        self.issue_count = len(issues) if total is None else total
        messages = self.issues.issue.drop_duplicates().tolist()
        super().__init__("; ".join(messages[:5]))


class IssueReport:
    def __init__(self):
        self.items = []
        self.total = 0

    def add(self, file, row, column, code, message, repair):
        self.total += 1
        if len(self.items) < MAX_REPORTED_ISSUES:
            self.items.append(dict(zip(ISSUE_COLUMNS, [file, row, column, code, message, repair])))

    def rows(self, name, df, mask, column, code, message, repair):
        indexes = df.index[mask]
        available = MAX_REPORTED_ISSUES - len(self.items)
        for index in indexes[:available]:
            self.add(f"{name}.csv", int(index) + 2, column, code, message, repair)
        self.total += max(0, len(indexes) - available)

    def stop_if_invalid(self):
        if self.total:
            raise DataQualityError(self.items, self.total)


@dataclass
class Bundle:
    tables: dict[str, pd.DataFrame]
    audit: pd.DataFrame
    snapshot: pd.Timestamp


def load_bundle(inputs: dict, snapshot) -> Bundle:
    report = IssueReport()
    try:
        snapshot = pd.Timestamp(snapshot)
        if pd.isna(snapshot):
            raise ValueError("missing snapshot")
        snapshot = (
            snapshot.tz_localize("UTC") if snapshot.tzinfo is None else snapshot.tz_convert("UTC")
        )
    except (ValueError, TypeError):
        report.add(
            "bundle",
            None,
            "snapshot",
            "invalid_snapshot",
            "Invalid snapshot timestamp",
            "Choose the timestamp represented by all three source files.",
        )
        report.stop_if_invalid()
    tables, audit = {}, []
    for name, columns in SCHEMAS.items():
        if inputs.get(name) is None:
            report.add(
                f"{name}.csv",
                None,
                "",
                "missing_file",
                f"Missing {name}.csv",
                "Supply all three CSV files from the same snapshot.",
            )
            continue
        try:
            df = pd.read_csv(
                inputs[name],
                dtype=str,
                keep_default_na=False,
                skip_blank_lines=False,
                nrows=100_001,
            )
        except (ValueError, UnicodeError, OSError, pd.errors.ParserError):
            report.add(
                f"{name}.csv",
                None,
                "",
                "unreadable_file",
                f"{name}: could not read UTF-8 CSV",
                "Export a UTF-8 comma-separated file with a header and consistent row widths.",
            )
            continue
        if not isinstance(df.index, pd.RangeIndex):
            report.add(
                f"{name}.csv",
                None,
                "",
                "row_width",
                f"{name}: data rows contain more fields than the header",
                "Correct delimiters and quoting so every row matches the header width.",
            )
            continue
        if list(df.columns) != columns:
            report.add(
                f"{name}.csv",
                1,
                "",
                "invalid_header",
                f"{name}: unexpected columns",
                f"Use exactly these ordered headers: {', '.join(columns)}",
            )
            continue
        if len(df) > 100_000:
            report.add(
                f"{name}.csv",
                None,
                "",
                "row_limit",
                f"{name}: maximum 100,000 rows",
                "Export a smaller, internally complete dataset.",
            )
            continue
        raw_count = len(df)
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
        # Keep original record indexes so diagnostics still refer to source CSV rows.
        df = df.drop_duplicates().copy()
        duplicates = raw_count - len(df)
        key = columns[0]
        report.rows(
            name,
            df,
            df[key].duplicated(keep=False),
            key,
            "duplicate_id",
            f"{name}: conflicting duplicate {key}",
            "Reconcile records sharing this ID; do not arbitrarily discard one.",
        )
        for col in columns:
            if col != "first_response_at":
                report.rows(
                    name,
                    df,
                    df[col].eq(""),
                    col,
                    "required_value",
                    f"{name}: {col} cannot be blank",
                    "Restore the value from the source.",
                )
        for col in DATES[name]:
            original = df[col]
            has_zone = original.str.contains(r"(?:Z|[+-]\d{2}:\d{2})$", regex=True)
            parsed = pd.to_datetime(original, utc=True, errors="coerce", format="ISO8601")
            bad = original.ne("") & (parsed.isna() | ~has_zone)
            report.rows(
                name,
                df,
                bad,
                col,
                "invalid_timestamp",
                f"{name}: {col} requires valid ISO 8601 timestamps with timezone",
                "Use an explicit offset, for example 2026-09-14T10:00:00Z.",
            )
            df[col] = parsed
            if col != "scheduled_at":
                report.rows(
                    name,
                    df,
                    parsed > snapshot,
                    col,
                    "after_snapshot",
                    f"{name}: {col} occurs after the snapshot",
                    "Correct the timestamp or use the actual common export snapshot.",
                )
        for col, allowed in (("source", SOURCES), ("service", SERVICES), ("status", STATUSES)):
            if col in df:
                report.rows(
                    name,
                    df,
                    df[col].ne("") & ~df[col].isin(allowed),
                    col,
                    "invalid_category",
                    f"{name}: unsupported {col}",
                    f"Map the source value to one of: {', '.join(sorted(allowed))}.",
                )
        if name == "jobs":
            cents = []
            for index, raw in df.revenue_usd.items():
                try:
                    if not re.fullmatch(r"[+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)", raw):
                        raise InvalidOperation
                    amount = Decimal(raw)
                    if amount > Decimal("1000000000"):
                        raise InvalidOperation
                    if amount != amount.quantize(Decimal("0.01")):
                        report.add(
                            f"{name}.csv",
                            int(index) + 2,
                            "revenue_usd",
                            "fractional_cent",
                            "jobs: revenue_usd must have at most two decimal places",
                            "Reconcile the amount to whole cents in the source export.",
                        )
                        cents.append(0)
                        continue
                    cents.append(int(amount * 100))
                except InvalidOperation:
                    report.add(
                        f"{name}.csv",
                        int(index) + 2,
                        "revenue_usd",
                        "invalid_amount",
                        "jobs: revenue_usd must be a finite nonnegative amount",
                        "Use plain decimal USD between 0 and 1,000,000,000 without symbols.",
                    )
                    cents.append(0)
            df["revenue_cents"] = pd.Series(cents, index=df.index, dtype="int64")
            df["revenue_usd"] = df.revenue_cents / 100
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

    # Fix field/schema issues before relationship checks, avoiding misleading cascades.
    report.stop_if_invalid()
    i, b, j = (tables[name] for name in SCHEMAS)
    report.rows(
        "bookings",
        b,
        ~b.inquiry_id.isin(i.inquiry_id),
        "inquiry_id",
        "orphan_id",
        "bookings: inquiry_id does not exist in inquiries",
        "Restore the missing inquiry or correct the reference from the source.",
    )
    report.rows(
        "jobs",
        j,
        ~j.booking_id.isin(b.booking_id),
        "booking_id",
        "orphan_id",
        "jobs: booking_id does not exist in bookings",
        "Restore the missing booking or correct the reference from the source.",
    )
    report.rows(
        "jobs",
        j,
        j.booking_id.duplicated(keep=False),
        "booking_id",
        "multiple_jobs",
        "jobs: only one completed job per booking is supported",
        "Reconcile the work-order export to one complete job per booking.",
    )
    report.rows(
        "inquiries",
        i,
        i.first_response_at < i.created_at,
        "first_response_at",
        "chronology",
        "inquiries: response occurs before inquiry",
        "Verify both timestamps and their timezone offsets.",
    )
    created = b.inquiry_id.map(i.set_index("inquiry_id").created_at)
    report.rows(
        "bookings",
        b,
        (b.booked_at < created) | (b.scheduled_at < b.booked_at),
        "booked_at,scheduled_at",
        "chronology",
        "bookings: invalid inquiry / booking / appointment chronology",
        "Booking must follow inquiry creation; appointment must follow booking.",
    )
    report.rows(
        "bookings",
        b,
        b.status.eq("no_show") & (b.scheduled_at > snapshot),
        "status",
        "future_no_show",
        "bookings: future appointment cannot be a no-show",
        "Correct status or scheduled time against the export snapshot.",
    )
    parent = b.set_index("booking_id")
    status = j.booking_id.map(parent.status)
    booked = j.booking_id.map(parent.booked_at)
    report.rows(
        "jobs",
        j,
        status.notna() & ~status.eq("completed"),
        "booking_id",
        "status_mismatch",
        "jobs: associated booking must have completed status",
        "Reconcile the booking outcome and its job record.",
    )
    report.rows(
        "jobs",
        j,
        j.completed_at < booked,
        "completed_at",
        "chronology",
        "jobs: completion occurs before booking",
        "Verify the completion and booking times.",
    )
    report.rows(
        "bookings",
        b,
        b.status.eq("completed") & ~b.booking_id.isin(j.booking_id),
        "booking_id",
        "missing_job",
        "bookings: completed booking is missing its job record",
        "Include the completed job or correct the booking status.",
    )
    report.stop_if_invalid()
    return Bundle(
        {name: df.reset_index(drop=True) for name, df in tables.items()},
        pd.DataFrame(audit),
        snapshot,
    )


def demo_inputs(root: Path) -> dict:
    return {name: root / "data" / "demo" / f"{name}.csv" for name in SCHEMAS}
