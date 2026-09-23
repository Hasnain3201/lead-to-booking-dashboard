"""Inquiry-cohort metrics. Outcomes use the complete supplied snapshot."""

from pathlib import Path

import duckdb
import pandas as pd

from leadflow.data import Bundle

SOURCE_LABELS = {
    "google_ads": "Google Ads",
    "organic_search": "Organic search",
    "referral": "Referral",
    "social": "Social",
    "walk_in": "Walk-in",
    "unknown": "Unknown-source",
}


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
        "revenue_usd": int(df.revenue_cents.sum()) / 100,
    }


def source_metrics(df):
    rows = [{"source": source, **metrics(group)} for source, group in df.groupby("source")]
    return pd.DataFrame(rows)


def inquiry_outcomes(df):
    """Furthest outcome reached by each inquiry: completed > scheduled > lost > unbooked."""
    # Each completed booking has exactly one job, so the remainder are still scheduled.
    scheduled = df.bookings - df.cancellations - df.no_shows - df.completed_jobs
    outcome = pd.Series("unbooked", index=df.index)
    outcome[df.bookings.gt(0)] = "lost"
    outcome[scheduled.gt(0)] = "scheduled"
    outcome[df.completed_jobs.gt(0)] = "completed"
    return outcome


def flow_paths(df):
    """Inquiry counts by source, response status, and furthest outcome."""
    columns = ["source", "responded", "outcome", "inquiries"]
    if df.empty:
        return pd.DataFrame(columns=columns)
    paths = pd.DataFrame(
        {
            "source": df.source,
            "responded": df.first_response_at.notna(),
            "outcome": inquiry_outcomes(df),
        }
    )
    return paths.groupby(columns[:3]).size().rename("inquiries").reset_index()


def daily_trend(df):
    """Inquiries created per UTC day, with how many of them booked or completed work."""
    columns = ["date", "inquiries", "booked_leads", "completed_leads"]
    if df.empty:
        return pd.DataFrame(columns=columns)
    daily = (
        df.set_index("created_at")
        .resample("D")
        .agg(
            inquiries=("inquiry_id", "count"),
            booked_leads=("bookings", lambda values: int(values.gt(0).sum())),
            completed_leads=("completed_jobs", lambda values: int(values.gt(0).sum())),
        )
    )
    daily = daily.reset_index().rename(columns={"created_at": "date"})
    daily["date"] = daily.date.dt.strftime("%Y-%m-%d")
    return daily[columns]


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


def weekly_summary(df, snapshot, sample=True):
    # Last FULL Monday–Sunday week in UTC, excluding the snapshot's current week.
    end = snapshot.normalize() - pd.Timedelta(days=snapshot.weekday())
    start = end - pd.Timedelta(days=7)
    prior = start - pd.Timedelta(days=7)
    current = df.loc[(df.created_at >= start) & (df.created_at < end)]
    previous = df.loc[(df.created_at >= prior) & (df.created_at < start)]
    now, before = metrics(current), metrics(previous)
    change = now["inquiries"] - before["inquiries"]
    queue = attention_queue(current, snapshot)
    coverage = f"{now['response_coverage']:.1%}" if now["response_coverage"] is not None else "N/A"
    response = f"{now['response_hours']:.1f} hours" if now["response_hours"] is not None else "N/A"
    lines = [
        "# Weekly operations brief",
        "",
        "Sample workspace." if sample else "Uploaded dataset.",
        f"Inquiry cohort: {start.date()} to {(end - pd.Timedelta(days=1)).date()} (UTC).",
        f"Outcomes observed through {snapshot.isoformat()}.",
        "",
        f"- Inquiries: {now['inquiries']} ({change:+d} vs. prior full week).",
        f"- Recorded first responses: {coverage} coverage; mean response time: {response}.",
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
        label = SOURCE_LABELS.get(source, source)
        action = f"Review the unanswered {label} inquiries first and assign a follow-up owner."
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


def booking_details(bundle, selected):
    """One row per booking belonging to the selected inquiry cohort."""
    inquiries = selected[["inquiry_id", "source", "service"]]
    bookings = bundle.tables["bookings"].merge(
        inquiries, on="inquiry_id", how="inner", validate="many_to_one"
    )
    return bookings.merge(
        bundle.tables["jobs"].drop(columns="revenue_cents"),
        on="booking_id",
        how="left",
        validate="one_to_one",
    ).sort_values(["scheduled_at", "booking_id"])
