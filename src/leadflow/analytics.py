"""Inquiry-cohort metrics. Outcomes use the complete supplied snapshot."""

from pathlib import Path

import duckdb
import pandas as pd

from leadflow.data import Bundle


def cohort_table(bundle: Bundle, sql_path: Path) -> pd.DataFrame:
    with duckdb.connect(":memory:") as conn:
        conn.execute("SET TimeZone = 'UTC'")
        for name, table in bundle.tables.items():
            conn.register(name, table)
        return conn.execute(sql_path.read_text()).df()


def select_cohort(df, start, end, sources, services):
    start = pd.Timestamp(start, tz="UTC")
    exclusive_end = pd.Timestamp(end, tz="UTC") + pd.Timedelta(days=1)
    return df.loc[
        (df.created_at >= start)
        & (df.created_at < exclusive_end)
        & df.source.isin(sources)
        & df.service.isin(services)
    ].copy()


def metrics(df):
    total = len(df)
    bookings = int(df.bookings.sum())
    responded = int(df.first_response_at.notna().sum())
    return {
        "inquiries": total,
        "converted": int(df.bookings.gt(0).sum()),
        "conversion": float(df.bookings.gt(0).mean()) if total else None,
        "response_hours": float(df.response_hours.mean()) if responded else None,
        "response_coverage": responded / total if total else None,
        "bookings": bookings,
        "cancellations": int(df.cancellations.sum()),
        "cancellation_rate": float(df.cancellations.sum()) / bookings if bookings else None,
        "no_shows": int(df.no_shows.sum()),
        "completed_jobs": int(df.completed_jobs.sum()),
        "revenue_usd": float(df.revenue_usd.sum()),
    }


def source_metrics(df):
    rows = [{"source": source, **metrics(group)} for source, group in df.groupby("source")]
    return pd.DataFrame(rows)


def attention_queue(df, snapshot):
    result = df.loc[
        df.first_response_at.isna()
        & df.bookings.eq(0)
        & ((snapshot - df.created_at) >= pd.Timedelta(hours=24))
    ].copy()
    result["age_hours"] = (snapshot - result.created_at).dt.total_seconds() / 3600
    return result[["inquiry_id", "source", "service", "created_at", "age_hours"]].sort_values(
        "age_hours", ascending=False
    )


def weekly_summary(df, snapshot, synthetic=True):
    # Last FULL Monday–Sunday week in UTC, excluding the snapshot's current week.
    end = snapshot.normalize() - pd.Timedelta(days=snapshot.weekday())
    start = end - pd.Timedelta(days=7)
    prior = start - pd.Timedelta(days=7)
    current = df.loc[(df.created_at >= start) & (df.created_at < end)]
    previous = df.loc[(df.created_at >= prior) & (df.created_at < start)]
    now, before = metrics(current), metrics(previous)
    change = now["inquiries"] - before["inquiries"]
    queue = attention_queue(current, snapshot)
    lines = [
        "# Weekly operations brief",
        "",
        "SYNTHETIC DEMO — no real business results." if synthetic else "Uploaded dataset.",
        f"Inquiry cohort: {start.date()} to {(end - pd.Timedelta(days=1)).date()} (UTC).",
        f"Outcomes observed through {snapshot.isoformat()}.",
        "",
        f"- Inquiries: {now['inquiries']} ({change:+d} vs. prior full week).",
        f"- Leads with a booking: {now['converted']} of {now['inquiries']}.",
        f"- Completed jobs attributed to this cohort: {now['completed_jobs']}.",
        f"- Recorded job revenue: ${now['revenue_usd']:,.2f} (not profit or cash collected).",
        f"- Cancellations: {now['cancellations']} of {now['bookings']} bookings.",
        f"- Unanswered, unbooked inquiries older than 24 hours: {len(queue)}.",
        "",
    ]
    if queue.empty:
        action = "Review cancellations and confirm whether replacement bookings were made."
    else:
        source = queue.groupby("source").size().idxmax()
        action = f"Review the unanswered {source} inquiries first and assign a follow-up owner."
    if current.empty:
        action = "Import records for the last full week before drawing conclusions."
    lines += [
        f"Suggested action: {action}",
        "",
        "Recent cohorts have had less time to book and finish jobs. Changes are descriptive; "
        "they do not establish causation. Missing responses are excluded from the mean, "
        "and no financial uplift is claimed.",
    ]
    return "\n".join(lines)


def safe_csv(df):
    """Neutralize spreadsheet formulas in downloaded text cells."""
    export = df.copy()
    for col in export.select_dtypes(include=["object", "string"]):
        export[col] = export[col].map(
            lambda value: (
                "'" + value
                if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@"))
                else value
            )
        )
    return export.to_csv(index=False).encode("utf-8")
