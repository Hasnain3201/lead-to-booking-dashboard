"""Run with: python -m streamlit run app.py"""

import json
import sys
from datetime import date
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

# Run directly from a checkout even when a host skips editable-install .pth files.
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from leadflow.analytics import (  # noqa: E402
    attention_queue,
    cohort_table,
    metrics,
    safe_csv,
    select_cohort,
    source_metrics,
    weekly_summary,
)
from leadflow.data import SCHEMAS, DataQualityError, demo_inputs, load_bundle  # noqa: E402

st.set_page_config(page_title="Leadflow | Lead-to-booking", page_icon="↗", layout="wide")
st.title("Leadflow")
st.caption("FROM FIRST INQUIRY TO FINISHED JOB")
st.sidebar.title("Workspace")
mode = st.sidebar.radio("Data source", ["Synthetic demo", "Upload CSVs"])
synthetic = mode == "Synthetic demo"
if synthetic:
    manifest = json.loads((ROOT / "data/demo/manifest.json").read_text())
    snapshot = pd.Timestamp(manifest["snapshot"])
    inputs = demo_inputs(ROOT)
    st.info("Harbor Home Services · Fictional business · All records and results are synthetic.")
else:
    st.info(
        "Upload three matching CSVs. Files are processed in memory and are not saved by this app."
    )
    snapshot_date = st.sidebar.date_input("Snapshot date (UTC)", value=date.today())
    snapshot = pd.Timestamp(snapshot_date, tz="UTC") + pd.Timedelta(days=1, microseconds=-1)
    inputs = {
        name: st.sidebar.file_uploader(f"{name}.csv", type="csv", key=name) for name in SCHEMAS
    }
    if any(value is None for value in inputs.values()):
        st.warning("Add inquiries, bookings, and jobs files to begin. Demo files show the format.")
        st.stop()
    for value in inputs.values():
        value.seek(0)

try:
    bundle = load_bundle(inputs, snapshot)
except DataQualityError as exc:
    st.error(f"Import paused: {exc}")
    st.caption(
        "Correct the source file and re-upload the full bundle. No partial metrics are shown."
    )
    st.stop()

full = cohort_table(bundle, ROOT / "sql/cohort.sql")
if full.empty:
    st.info("The files are valid but contain no inquiries. Add records to display metrics.")
    st.stop()
st.sidebar.caption(f"Outcomes through {snapshot.strftime('%b %d, %Y %H:%M')} UTC")
dates = st.sidebar.date_input(
    "Inquiry date range (UTC)", value=(full.created_at.min().date(), full.created_at.max().date())
)
sources = st.sidebar.multiselect(
    "Lead sources", sorted(full.source.unique()), default=sorted(full.source.unique())
)
services = st.sidebar.multiselect(
    "Services", sorted(full.service.unique()), default=sorted(full.service.unique())
)
if len(dates) != 2:
    st.info("Select both a start and an end date.")
    st.stop()
selected = select_cohort(full, dates[0], dates[1], sources, services)
st.caption(
    "Date filters select when inquiries arrived. Their bookings and jobs are counted through "
    "the snapshot, even if they happened later. All times are UTC."
)

overview, channels, followup, quality, brief = st.tabs(
    ["Overview", "Lead sources", "Needs attention", "Data quality", "Weekly brief"]
)


def percent(value):
    return "N/A" if value is None else f"{value:.1%}"


with overview:
    m = metrics(selected)
    cards = st.columns(5)
    cards[0].metric("Inquiries", f"{m['inquiries']:,}")
    cards[1].metric("Booked at least once", percent(m["conversion"]))
    cards[2].metric(
        "Avg. first response",
        "N/A" if m["response_hours"] is None else f"{m['response_hours']:.1f} h",
    )
    cards[3].metric("Completed jobs", f"{m['completed_jobs']:,}")
    cards[4].metric("Cancelled bookings", percent(m["cancellation_rate"]))
    st.caption(
        f"Response timestamp coverage: {percent(m['response_coverage'])}. "
        f"{m['cancellations']} cancellations / {m['bookings']} bookings; "
        f"{m['no_shows']} no-shows shown separately."
    )
    if selected.empty:
        st.info(
            "No inquiries match these filters. Try a wider range or select a source and service."
        )
    else:
        left, right = st.columns([1, 1.8])
        with left:
            funnel = pd.DataFrame(
                {
                    "Stage": ["Inquired", "Booked", "Completed a job"],
                    "Leads": [
                        len(selected),
                        selected.bookings.gt(0).sum(),
                        selected.completed_jobs.gt(0).sum(),
                    ],
                }
            )
            st.plotly_chart(
                px.funnel(funnel, x="Leads", y="Stage", title="Where leads drop off"),
                width="stretch",
            )
        with right:
            trend = selected.set_index("created_at").resample("W-MON", label="left", closed="left")
            trend = trend.agg(
                inquiries=("inquiry_id", "count"),
                booked_leads=("bookings", lambda values: values.gt(0).sum()),
            )
            st.plotly_chart(
                px.line(
                    trend.reset_index(),
                    x="created_at",
                    y=["inquiries", "booked_leads"],
                    markers=True,
                    title="Weekly inquiry cohorts",
                    labels={"created_at": "Week"},
                ),
                width="stretch",
            )
        st.caption("The most recent cohorts have had less time to convert or complete work.")
    with st.expander("How these numbers are defined"):
        st.markdown((ROOT / "docs/METRICS.md").read_text())

with channels:
    st.subheader("Which sources lead to completed work?")
    source_table = source_metrics(selected)
    if not source_table.empty:
        st.plotly_chart(
            px.bar(
                source_table,
                x="source",
                y="completed_jobs",
                color="source",
                title="Completed jobs by original inquiry source",
            ),
            width="stretch",
        )
        st.dataframe(source_table, hide_index=True, width="stretch")
        st.download_button("Download source metrics", safe_csv(source_table), "source-metrics.csv")
    else:
        st.info("No source metrics for this selection.")
    st.caption(
        "Revenue is completed-job value in USD, not profit, cash collected, or marketing ROI. "
        "No advertising costs or capacity data are included."
    )

with followup:
    queue = attention_queue(selected, snapshot)
    st.subheader(f"{len(queue)} inquiries need a first response")
    st.caption(
        "No recorded response, no booking, and at least 24 hours old at the snapshot. "
        "Review records before contacting anyone; the dashboard sends no messages."
    )
    st.dataframe(queue, hide_index=True, width="stretch")
    st.download_button("Download follow-up list", safe_csv(queue), "follow-up.csv")
    with st.expander("Inspect all selected inquiry records"):
        st.dataframe(selected, hide_index=True, width="stretch")
        st.download_button("Download selected records", safe_csv(selected), "inquiries.csv")

with quality:
    st.subheader("Import receipt")
    st.dataframe(bundle.audit, hide_index=True, width="stretch")
    st.success(
        "Required fields, IDs, relationships, timestamps, statuses, and revenue passed validation."
    )
    st.caption(
        "Matching duplicate rows are removed after normalization. Conflicting duplicate IDs "
        "and orphan records block the entire import. Missing responses remain missing."
    )
    st.download_button("Download import receipt", safe_csv(bundle.audit), "import-receipt.csv")
    st.subheader("Sample input files")
    for name, path in demo_inputs(ROOT).items():
        st.download_button(f"Download demo {name}", path.read_bytes(), f"{name}.csv")

with brief:
    st.caption(
        "Last complete Monday–Sunday week before the snapshot's current week. "
        "Uses the selected sources and services; ignores the inquiry date-range filter "
        "so the two comparison weeks stay complete."
    )
    weekly_data = full.loc[full.source.isin(sources) & full.service.isin(services)]
    summary = weekly_summary(weekly_data, snapshot, synthetic=synthetic)
    st.markdown(summary)
    st.download_button("Download weekly brief", summary, "weekly-brief.md", mime="text/markdown")
