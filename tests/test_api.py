from pathlib import Path

import pytest
from starlette.testclient import TestClient

from leadflow.api import create_app

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "data/demo"


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app(uploads_enabled=True, dist=ROOT / "missing-dist"))


def demo_files(bookings=DEMO / "bookings.csv"):
    return {
        "inquiries": ("inquiries.csv", (DEMO / "inquiries.csv").read_bytes(), "text/csv"),
        "bookings": ("bookings.csv", Path(bookings).read_bytes(), "text/csv"),
        "jobs": ("jobs.csv", (DEMO / "jobs.csv").read_bytes(), "text/csv"),
    }


def test_demo_meta_and_view_reconcile_with_known_totals(client):
    meta = client.get("/api/datasets/demo").json()
    assert meta["synthetic"] is True
    assert meta["inquiries"] == 720
    assert meta["first_date"] <= meta["last_date"]
    view = client.get("/api/datasets/demo/view").json()
    summary = view["metrics"]
    assert summary["inquiries"] == 720
    assert summary["bookings"] == 345
    assert summary["completed_jobs"] == 261
    assert len(view["inquiries"]) == 720
    assert sum(row["revenue_cents"] for row in view["inquiries"]) == summary["revenue_cents"]
    assert sum(row["responded"] for row in view["inquiries"]) == round(
        summary["response_coverage"] * 720
    )
    assert sum(path["inquiries"] for path in view["flow"]) == 720
    assert sum(day["inquiries"] for day in view["timeline"]) == 720
    assert sum(source["inquiries"] for source in view["sources"]) == 720
    assert len(view["attention"]) == 73
    assert summary["revenue_cents"] == round(summary["revenue_usd"] * 100)
    booked = sum(p["inquiries"] for p in view["flow"] if p["outcome"] != "unbooked")
    assert booked == summary["converted"]
    completed = sum(p["inquiries"] for p in view["flow"] if p["outcome"] == "completed")
    assert completed <= summary["completed_jobs"]
    assert "SYNTHETIC DEMO" in view["brief"]


def test_filters_narrow_cohort_but_timeline_keeps_full_date_context(client):
    meta = client.get("/api/datasets/demo").json()
    params = {"sources": "referral", "services": "cleaning", "start": meta["last_date"]}
    view = client.get("/api/datasets/demo/view", params=params).json()
    assert view["metrics"]["inquiries"] < 20
    assert {source["source"] for source in view["sources"]} <= {"referral"}
    timeline_total = sum(day["inquiries"] for day in view["timeline"])
    assert timeline_total > view["metrics"]["inquiries"]


def test_empty_selection_returns_safe_nulls(client):
    view = client.get("/api/datasets/demo/view", params={"sources": ""}).json()
    assert view["metrics"]["inquiries"] == 0
    assert view["metrics"]["conversion"] is None
    assert view["inquiries"] == [] and view["flow"] == [] and view["attention"] == []


def test_invalid_date_range_is_rejected(client):
    response = client.get(
        "/api/datasets/demo/view", params={"start": "2026-09-10", "end": "2026-09-01"}
    )
    assert response.status_code == 400
    assert client.get("/api/datasets/demo/view", params={"start": "soon"}).status_code == 400


def test_inquiry_detail_keeps_every_booking(client):
    view = client.get("/api/datasets/demo/view").json()
    repeat = next(row["inquiry_id"] for row in view["inquiries"] if row["bookings"] > 1)
    detail = client.get(f"/api/datasets/demo/inquiries/{repeat}").json()
    assert detail["inquiry"]["inquiry_id"] == repeat
    assert len(detail["bookings"]) == detail["inquiry"]["bookings"]
    assert client.get("/api/datasets/demo/inquiries/NOPE").status_code == 404


def test_exports_match_view_and_neutralize_formulas(client):
    params = {"sources": "social"}
    view = client.get("/api/datasets/demo/view", params=params).json()
    follow_up = client.get("/api/datasets/demo/exports/follow-up.csv", params=params)
    assert follow_up.headers["content-disposition"].endswith('"follow-up.csv"')
    assert len(follow_up.text.strip().splitlines()) == len(view["attention"]) + 1
    brief = client.get("/api/datasets/demo/exports/weekly-brief.md", params=params)
    assert brief.text == view["brief"]
    assert client.get("/api/datasets/demo/exports/secrets.csv").status_code == 404


def test_valid_upload_creates_a_non_synthetic_dataset(client):
    response = client.post("/api/datasets", files=demo_files(), data={"snapshot": "2026-09-23"})
    assert response.status_code == 201
    dataset = response.json()["id"]
    meta = client.get(f"/api/datasets/{dataset}").json()
    assert meta["synthetic"] is False and meta["inquiries"] == 720
    brief = client.get(f"/api/datasets/{dataset}/view").json()["brief"]
    assert "SYNTHETIC" not in brief


def test_invalid_upload_returns_issue_report_and_no_dataset(client):
    orphan = ROOT / "data/invalid/bookings_orphan.csv"
    response = client.post(
        "/api/datasets", files=demo_files(orphan), data={"snapshot": "2026-09-23"}
    )
    assert response.status_code == 422
    body = response.json()
    assert body["issue_count"] >= 1
    assert body["issues"][0]["code"] == "orphan_id"
    assert "id" not in body


def test_missing_files_are_reported(client):
    files = {"jobs": demo_files()["jobs"]}
    response = client.post("/api/datasets", files=files, data={"snapshot": "2026-09-23"})
    assert response.status_code == 422
    issues = response.json()["issues"]
    assert {issue["code"] for issue in issues} == {"missing_file"}
    assert {issue["file"] for issue in issues} == {"inquiries.csv", "bookings.csv"}


def test_oversized_upload_is_rejected(client):
    files = demo_files()
    files["jobs"] = ("jobs.csv", b"x" * (5 * 1024 * 1024 + 1), "text/csv")
    response = client.post("/api/datasets", files=files, data={"snapshot": "2026-09-23"})
    assert response.status_code == 413
    assert "5 MB" in response.json()["detail"]


def test_uploads_can_be_disabled_for_public_demos():
    client = TestClient(create_app(uploads_enabled=False, dist=ROOT / "missing-dist"))
    assert client.post("/api/datasets", files=demo_files()).status_code == 403
    assert client.get("/api/datasets/demo").json()["uploads_enabled"] is False


def test_unknown_dataset_and_samples(client):
    assert client.get("/api/datasets/abc/view").status_code == 404
    assert client.get("/api/samples/inquiries.csv").status_code == 200
    assert client.get("/api/samples/..%2Fpyproject.toml").status_code == 404
