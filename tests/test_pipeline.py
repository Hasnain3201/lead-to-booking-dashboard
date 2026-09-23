from io import StringIO
from pathlib import Path

import pandas as pd
import pytest

from leadflow.analytics import (
    attention_queue,
    cohort_table,
    metrics,
    safe_csv,
    select_cohort,
    weekly_summary,
)
from leadflow.data import SCHEMAS, DataQualityError, demo_inputs, load_bundle

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = "2026-09-21T00:00:00Z"


def fixture_inputs():
    rows = {
        "inquiries": [
            ["I1", "2026-09-14T10:00:00Z", "referral", "cleaning", "2026-09-14T12:00:00Z"],
            ["I2", "2026-09-14T10:00:00Z", "social", "cleaning", ""],
            ["I3", "2026-09-15T10:00:00Z", "referral", "cleaning", "2026-09-15T16:00:00Z"],
            ["I4", "2026-09-20T22:00:00Z", "social", "cleaning", ""],
        ],
        "bookings": [
            ["B1", "I1", "2026-09-14T13:00:00Z", "2026-09-15T10:00:00Z", "completed"],
            ["B2", "I1", "2026-09-15T13:00:00Z", "2026-09-16T10:00:00Z", "cancelled"],
            ["B3", "I3", "2026-09-15T17:00:00Z", "2026-09-16T10:00:00Z", "no_show"],
        ],
        "jobs": [["J1", "B1", "2026-09-15T12:00:00Z", "125.50"]],
    }
    return {name: pd.DataFrame(data, columns=SCHEMAS[name]) for name, data in rows.items()}


def serialize(tables):
    return {name: StringIO(df.to_csv(index=False)) for name, df in tables.items()}


def load_fixture(tables=None):
    return load_bundle(serialize(fixture_inputs() if tables is None else tables), SNAPSHOT)


def test_hand_calculated_metrics_do_not_double_count_repeat_bookings():
    bundle = load_fixture()
    cohort = cohort_table(bundle, ROOT / "sql/cohort.sql")
    result = metrics(cohort)
    assert len(cohort) == 4
    assert str(cohort.created_at.dt.tz) == "UTC"
    assert result["conversion"] == 0.5
    assert result["response_hours"] == 4  # Not (2 + 2 + 6) / 3 from a fan-out join.
    assert result["response_coverage"] == 0.5
    assert result["cancellation_rate"] == pytest.approx(1 / 3)
    assert result["no_shows"] == 1
    assert result["completed_jobs"] == 1
    assert result["revenue_usd"] == 125.50
    assert attention_queue(cohort, bundle.snapshot).inquiry_id.tolist() == ["I2"]


def test_date_filter_includes_whole_end_date_and_later_outcomes():
    cohort = cohort_table(load_fixture(), ROOT / "sql/cohort.sql")
    selected = select_cohort(cohort, "2026-09-14", "2026-09-14", ["referral"], ["cleaning"])
    assert selected.inquiry_id.tolist() == ["I1"]
    assert metrics(selected)["completed_jobs"] == 1
    assert metrics(cohort.iloc[0:0])["conversion"] is None


def test_exact_duplicates_normalized_and_logged():
    tables = fixture_inputs()
    tables["inquiries"] = pd.concat([tables["inquiries"], tables["inquiries"].iloc[:1]])
    tables["inquiries"].iloc[0, 2] = " Referral "
    bundle = load_fixture(tables)
    assert len(bundle.tables["inquiries"]) == 4
    assert bundle.audit.duplicates_removed.sum() == 1
    assert bundle.audit.whitespace_rows.sum() == 1


@pytest.mark.parametrize(
    "case,expected",
    [
        ("orphan", "does not exist"),
        ("conflict", "conflicting duplicate"),
        ("negative", "nonnegative"),
        ("response", "response occurs before"),
        ("future", "after the snapshot"),
        ("timezone", "timezone"),
        ("status", "associated booking"),
        ("missing_job", "missing its job"),
        ("duplicate_job", "one completed job"),
        ("invalid_date", "ISO 8601"),
        ("fractional_cent", "decimal places"),
        ("infinite", "nonnegative"),
    ],
)
def test_bad_data_blocks_import(case, expected):
    t = fixture_inputs()
    if case == "orphan":
        t["bookings"].loc[0, "inquiry_id"] = "ABSENT"
    elif case == "conflict":
        t["inquiries"].loc[1, "inquiry_id"] = "I1"
    elif case in {"negative", "fractional_cent", "infinite"}:
        t["jobs"].loc[0, "revenue_usd"] = {
            "negative": "-2",
            "fractional_cent": "0.123",
            "infinite": "inf",
        }[case]
    elif case == "response":
        t["inquiries"].loc[0, "first_response_at"] = "2026-09-01T00:00:00Z"
    elif case == "future":
        t["inquiries"].loc[0, "first_response_at"] = "2026-10-01T00:00:00Z"
    elif case == "timezone":
        t["inquiries"].loc[0, "created_at"] = "2026-09-14T10:00:00"
    elif case == "invalid_date":
        t["inquiries"].loc[0, "created_at"] = "not-a-date"
    elif case == "status":
        t["bookings"].loc[0, "status"] = "cancelled"
    elif case == "missing_job":
        t["jobs"] = t["jobs"].iloc[:0]
    elif case == "duplicate_job":
        duplicate = t["jobs"].copy()
        duplicate["job_id"] = "J2"
        t["jobs"] = pd.concat([t["jobs"], duplicate])
    with pytest.raises(DataQualityError, match=expected):
        load_fixture(t)


def test_header_only_bundle_and_no_response_average():
    empty = {name: df.iloc[:0] for name, df in fixture_inputs().items()}
    assert cohort_table(load_fixture(empty), ROOT / "sql/cohort.sql").empty
    t = fixture_inputs()
    t["inquiries"]["first_response_at"] = ""
    result = metrics(cohort_table(load_fixture(t), ROOT / "sql/cohort.sql"))
    assert result["response_hours"] is None
    assert result["response_coverage"] == 0


def test_weekly_summary_and_export_safety():
    bundle = load_fixture()
    cohort = cohort_table(bundle, ROOT / "sql/cohort.sql")
    brief = weekly_summary(cohort, bundle.snapshot)
    assert "2026-09-14 to 2026-09-20" in brief
    assert "Inquiries: 4 (+4" in brief
    assert "SYNTHETIC DEMO" in brief
    assert "social" in brief
    assert "'=SUM" in safe_csv(pd.DataFrame({"id": ["=SUM(1)"]})).decode()


def test_seeded_demo_and_intentionally_bad_example():
    inputs = demo_inputs(ROOT)
    bundle = load_bundle(inputs, SNAPSHOT)
    assert len(bundle.tables["inquiries"]) == 720
    assert bundle.audit.duplicates_removed.sum() == 3
    assert metrics(cohort_table(bundle, ROOT / "sql/cohort.sql"))["conversion"] < 1
    inputs["bookings"] = ROOT / "data/invalid/bookings_orphan.csv"
    with pytest.raises(DataQualityError, match="does not exist"):
        load_bundle(inputs, SNAPSHOT)


def test_booking_drilldown_reconciles_and_preserves_unfinished_jobs():
    from leadflow.analytics import booking_details

    bundle = load_fixture()
    cohort = cohort_table(bundle, ROOT / "sql/cohort.sql")
    details = booking_details(bundle, cohort)
    assert len(details) == metrics(cohort)["bookings"] == 3
    assert details.status.eq("cancelled").sum() == metrics(cohort)["cancellations"]
    assert details.status.eq("no_show").sum() == metrics(cohort)["no_shows"]
    assert details.job_id.notna().sum() == metrics(cohort)["completed_jobs"]
    assert details.revenue_usd.sum() == metrics(cohort)["revenue_usd"]
    repeat = booking_details(bundle, cohort.loc[cohort.inquiry_id.eq("I1")])
    assert set(repeat.booking_id) == {"B1", "B2"}
    assert repeat.loc[repeat.booking_id.eq("B2"), "job_id"].isna().all()
    assert booking_details(bundle, cohort.loc[cohort.inquiry_id.eq("I2")]).empty
    assert booking_details(bundle, cohort.iloc[:0]).empty


def test_weekly_response_coverage_and_channel_reconciliation():
    from leadflow.analytics import source_metrics

    bundle = load_fixture()
    cohort = cohort_table(bundle, ROOT / "sql/cohort.sql")
    channels = source_metrics(cohort)
    overall = metrics(cohort)
    for key in [
        "inquiries",
        "converted",
        "bookings",
        "cancellations",
        "no_shows",
        "completed_jobs",
        "revenue_usd",
    ]:
        assert channels[key].sum() == overall[key]
    brief = weekly_summary(cohort, bundle.snapshot)
    assert "50.0% coverage; mean response time: 4.0 hours" in brief
    empty = weekly_summary(cohort.iloc[:0], bundle.snapshot)
    assert "N/A coverage; mean response time: N/A" in empty


def test_issue_report_collects_fields_across_files_with_original_rows():
    t = fixture_inputs()
    t["inquiries"] = pd.concat(
        [t["inquiries"].iloc[:1], t["inquiries"].iloc[:1], t["inquiries"].iloc[1:]],
        ignore_index=True,
    )
    t["inquiries"].loc[2, "service"] = "invalid"
    t["inquiries"].loc[3, "created_at"] = "bad-date"
    t["jobs"].loc[0, "revenue_usd"] = "-20"
    with pytest.raises(DataQualityError) as caught:
        load_fixture(t)
    issues = caught.value.issues
    assert caught.value.issue_count == 3
    assert set(zip(issues.file, issues.row, issues.column)) == {
        ("inquiries.csv", 4, "service"),
        ("inquiries.csv", 5, "created_at"),
        ("jobs.csv", 2, "revenue_usd"),
    }
    assert issues.repair.str.len().min() > 10


def test_issue_report_collects_independent_relationship_errors():
    t = fixture_inputs()
    t["bookings"].loc[1, "inquiry_id"] = "MISSING"
    t["jobs"].loc[0, "booking_id"] = "MISSING"
    with pytest.raises(DataQualityError) as caught:
        load_fixture(t)
    assert caught.value.issue_count == 3  # Two orphans and completed booking without job.
    assert set(caught.value.issues.code) == {"orphan_id", "missing_job"}


def test_issue_report_is_bounded_but_counts_all_field_errors():
    t = fixture_inputs()
    rows = pd.concat([t["inquiries"].iloc[:1]] * 250, ignore_index=True)
    rows["inquiry_id"] = [f"I{n}" for n in range(250)]
    rows["service"] = "bad"
    t["inquiries"] = rows
    with pytest.raises(DataQualityError) as caught:
        load_fixture(t)
    assert caught.value.issue_count == 250
    assert len(caught.value.issues) == 200
    assert caught.value.issues.row.tolist() == list(range(2, 202))


def test_missing_and_malformed_files_are_reported_together():
    from io import BytesIO

    inputs = serialize(fixture_inputs())
    del inputs["bookings"]
    inputs["jobs"] = BytesIO(b"\xff\xfeinvalid")
    with pytest.raises(DataQualityError) as caught:
        load_bundle(inputs, SNAPSHOT)
    assert set(caught.value.issues.code) == {"missing_file", "unreadable_file"}


@pytest.mark.parametrize("snapshot", [None, "nonsense", "NaT"])
def test_invalid_snapshot_is_actionable(snapshot):
    with pytest.raises(DataQualityError) as caught:
        load_bundle(serialize(fixture_inputs()), snapshot)
    assert caught.value.issues.code.tolist() == ["invalid_snapshot"]


def test_mixed_offsets_represent_same_elapsed_time():
    t = fixture_inputs()
    t["inquiries"].loc[0, "created_at"] = "2026-09-14T06:00:00-04:00"
    t["inquiries"].loc[0, "first_response_at"] = "2026-09-14T14:00:00+02:00"
    cohort = cohort_table(load_fixture(t), ROOT / "sql/cohort.sql")
    assert cohort.loc[cohort.inquiry_id.eq("I1"), "response_hours"].item() == 2


def test_no_bookings_and_blank_input_record_are_handled():
    t = fixture_inputs()
    t["bookings"] = t["bookings"].iloc[:0]
    t["jobs"] = t["jobs"].iloc[:0]
    result = metrics(cohort_table(load_fixture(t), ROOT / "sql/cohort.sql"))
    assert result["conversion"] == 0
    assert result["cancellation_rate"] is None
    inputs = serialize(t)
    inputs["inquiries"] = StringIO(inputs["inquiries"].getvalue() + "\n")
    with pytest.raises(DataQualityError) as caught:
        load_bundle(inputs, SNAPSHOT)
    assert "required_value" in set(caught.value.issues.code)


@pytest.mark.parametrize(
    "amount",
    ["0.001", "1.000000000000000000000000001", "1000000001", "1e309", "1_000", "NaN", "-0.01"],
)
def test_amounts_are_validated_without_float_rounding(amount):
    t = fixture_inputs()
    t["jobs"].loc[0, "revenue_usd"] = amount
    with pytest.raises(DataQualityError):
        load_fixture(t)


def test_revenue_is_aggregated_in_integer_cents():
    t = fixture_inputs()
    t["bookings"].loc[1, "status"] = "completed"
    t["jobs"].loc[0, "revenue_usd"] = "0.10"
    t["jobs"].loc[1] = ["J2", "B2", "2026-09-16T12:00:00Z", "0.20"]
    bundle = load_fixture(t)
    cohort = cohort_table(bundle, ROOT / "sql/cohort.sql")
    assert bundle.tables["jobs"].revenue_cents.tolist() == [10, 20]
    assert cohort.revenue_cents.sum() == 30
    assert metrics(cohort)["revenue_usd"] == 0.30


def test_excess_csv_fields_do_not_become_a_hidden_index():
    inputs = serialize(fixture_inputs())
    inputs["jobs"] = StringIO(
        "job_id,booking_id,completed_at,revenue_usd\nEXTRA,J1,B1,2026-09-15T12:00:00Z,100\n"
    )
    with pytest.raises(DataQualityError) as caught:
        load_bundle(inputs, SNAPSHOT)
    assert caught.value.issues.code.tolist() == ["row_width"]
