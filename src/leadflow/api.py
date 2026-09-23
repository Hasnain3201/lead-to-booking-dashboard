"""Local JSON API for the Leadflow interface. All metrics come from leadflow.analytics."""

import json
import os
import uuid
from collections import OrderedDict
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import pandas as pd
from starlette.applications import Starlette
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException
from starlette.formparsers import MultiPartException, MultiPartParser
from starlette.responses import FileResponse, JSONResponse, Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from leadflow.analytics import (
    attention_queue,
    booking_details,
    cohort_table,
    daily_trend,
    flow_paths,
    inquiry_outcomes,
    metrics,
    safe_csv,
    select_cohort,
    source_metrics,
    weekly_summary,
)
from leadflow.data import SCHEMAS, Bundle, DataQualityError, demo_inputs, load_bundle

ROOT = Path(__file__).resolve().parents[2]
SQL = ROOT / "sql/cohort.sql"
DIST = ROOT / "frontend/dist"
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_UPLOADED_DATASETS = 4
RECORD_COLUMNS = [
    "inquiry_id",
    "created_at",
    "source",
    "service",
    "response_hours",
    "bookings",
    "completed_jobs",
    "revenue_cents",
]
SAMPLES = {
    **{f"{name}.csv": path for name, path in demo_inputs(ROOT).items()},
    "bookings_orphan.csv": ROOT / "data/invalid/bookings_orphan.csv",
}


class InMemoryParser(MultiPartParser):
    # Keep uploaded files in memory instead of spilling them to temporary files.
    spool_max_size = MAX_FILE_BYTES


@dataclass
class Dataset:
    id: str
    label: str
    synthetic: bool
    bundle: Bundle
    cohort: pd.DataFrame


def records(frame):
    return json.loads(frame.to_json(orient="records", date_format="iso"))


def build_dataset(dataset_id, label, synthetic, inputs, snapshot):
    bundle = load_bundle(inputs, snapshot)
    return Dataset(dataset_id, label, synthetic, bundle, cohort_table(bundle, SQL))


def demo_dataset():
    manifest = json.loads((ROOT / "data/demo/manifest.json").read_text())
    return build_dataset(
        "demo", manifest["business"], True, demo_inputs(ROOT), manifest["snapshot"]
    )


class Store:
    """Demo plus a few recent uploads, held in memory only and never written to disk."""

    def __init__(self):
        self.demo = demo_dataset()
        self.uploads = OrderedDict()

    def get(self, dataset_id):
        if dataset_id == "demo":
            return self.demo
        if dataset_id not in self.uploads:
            raise HTTPException(404, "Dataset not found. Upload the files again.")
        self.uploads.move_to_end(dataset_id)
        return self.uploads[dataset_id]

    def add(self, dataset):
        self.uploads[dataset.id] = dataset
        while len(self.uploads) > MAX_UPLOADED_DATASETS:
            self.uploads.popitem(last=False)


def parse_list(request, name, allowed):
    raw = request.query_params.get(name)
    if raw is None:
        return sorted(allowed)
    return [value for value in raw.split(",") if value in allowed]


def filters(request, dataset):
    full = dataset.cohort
    sources = parse_list(request, "sources", set(full.source))
    services = parse_list(request, "services", set(full.service))
    try:
        start = pd.Timestamp(request.query_params.get("start") or full.created_at.min().date())
        end = pd.Timestamp(request.query_params.get("end") or full.created_at.max().date())
    except ValueError as exc:
        raise HTTPException(400, "Dates must use YYYY-MM-DD.") from exc
    if start > end:
        raise HTTPException(400, "Start date must be on or before end date.")
    selected = select_cohort(full, start.date(), end.date(), sources, services)
    context = full.loc[full.source.isin(sources) & full.service.isin(services)]
    return selected, context, sources, services


def failed_bookings(dataset, selected):
    details = booking_details(dataset.bundle, selected)
    return details.loc[details.status.isin(["cancelled", "no_show"])]


def meta(request):
    dataset = request.app.state.store.get(request.path_params["dataset"])
    full, bundle = dataset.cohort, dataset.bundle
    return JSONResponse(
        {
            "id": dataset.id,
            "label": dataset.label,
            "synthetic": dataset.synthetic,
            "snapshot": bundle.snapshot.isoformat(),
            "reporting_timezone": "UTC",
            "sources": sorted(full.source.unique()),
            "services": sorted(full.service.unique()),
            "first_date": None if full.empty else str(full.created_at.min().date()),
            "last_date": None if full.empty else str(full.created_at.max().date()),
            "inquiries": len(full),
            "import_receipt": records(bundle.audit),
            "uploads_enabled": request.app.state.uploads_enabled,
        }
    )


def view(request):
    dataset = request.app.state.store.get(request.path_params["dataset"])
    selected, context, _, _ = filters(request, dataset)
    snapshot = dataset.bundle.snapshot
    queue = attention_queue(selected, snapshot)
    failed = failed_bookings(dataset, selected)
    summary = metrics(selected)
    summary["revenue_cents"] = int(selected.revenue_cents.sum())
    inquiries = selected[RECORD_COLUMNS].assign(
        responded=selected.first_response_at.notna(), outcome=inquiry_outcomes(selected)
    )
    return JSONResponse(
        {
            "metrics": summary,
            "sources": records(source_metrics(selected)),
            "flow": records(flow_paths(selected)),
            "inquiries": records(inquiries),
            "timeline": records(daily_trend(context)),
            "attention": records(queue),
            "failed_bookings": records(failed),
            "brief": weekly_summary(context, snapshot, synthetic=dataset.synthetic),
        }
    )


def inquiry_detail(request):
    dataset = request.app.state.store.get(request.path_params["dataset"])
    full = dataset.cohort
    row = full.loc[full.inquiry_id.eq(request.path_params["inquiry_id"])]
    if row.empty:
        raise HTTPException(404, "Inquiry not found.")
    inquiry = records(row.assign(outcome=inquiry_outcomes(row)))[0]
    history = booking_details(dataset.bundle, row)
    return JSONResponse({"inquiry": inquiry, "bookings": records(history)})


def export(request):
    dataset = request.app.state.store.get(request.path_params["dataset"])
    kind = request.path_params["kind"]
    selected, context, _, _ = filters(request, dataset)
    snapshot = dataset.bundle.snapshot
    if kind == "weekly-brief.md":
        body = weekly_summary(context, snapshot, synthetic=dataset.synthetic).encode()
        media = "text/markdown; charset=utf-8"
    else:
        tables = {
            "follow-up.csv": lambda: attention_queue(selected, snapshot),
            "booking-outcomes.csv": lambda: failed_bookings(dataset, selected),
            "source-metrics.csv": lambda: source_metrics(selected),
            "inquiries.csv": lambda: selected,
            "import-receipt.csv": lambda: dataset.bundle.audit,
        }
        if kind not in tables:
            raise HTTPException(404, "Unknown export.")
        body, media = safe_csv(tables[kind]()), "text/csv; charset=utf-8"
    headers = {"Content-Disposition": f'attachment; filename="{kind}"'}
    return Response(body, media_type=media, headers=headers)


def sample(request):
    name = request.path_params["name"]
    if name not in SAMPLES:
        raise HTTPException(404, "Unknown sample file.")
    return FileResponse(SAMPLES[name], media_type="text/csv", filename=name)


async def upload(request):
    if not request.app.state.uploads_enabled:
        raise HTTPException(403, "Uploads are disabled on this deployment.")
    length = request.headers.get("content-length", "")
    if not length.isdigit():
        raise HTTPException(411, "Upload requests need a Content-Length header.")
    if int(length) > 3 * MAX_FILE_BYTES + 64 * 1024:
        raise HTTPException(413, "Each file must be 5 MB or smaller.")
    try:
        parser = InMemoryParser(request.headers, request.stream(), max_files=3, max_fields=4)
        form = await parser.parse()
    except MultiPartException as exc:
        raise HTTPException(400, exc.message) from exc
    inputs = {}
    for name in SCHEMAS:
        part = form.get(name)
        if isinstance(part, UploadFile):
            if (part.size or 0) > MAX_FILE_BYTES:
                raise HTTPException(413, "Each file must be 5 MB or smaller.")
            inputs[name] = BytesIO(await part.read())
        else:
            inputs[name] = None
    snapshot_date = form.get("snapshot") or ""
    try:
        snapshot = pd.Timestamp(str(snapshot_date), tz="UTC") + pd.Timedelta(
            days=1, microseconds=-1
        )
    except ValueError:
        snapshot = None
    try:
        dataset = build_dataset(uuid.uuid4().hex, "Uploaded files", False, inputs, snapshot)
    except DataQualityError as exc:
        return JSONResponse(
            {"issue_count": exc.issue_count, "issues": records(exc.issues)}, status_code=422
        )
    request.app.state.store.add(dataset)
    return JSONResponse({"id": dataset.id}, status_code=201)


async def http_error(request, exc):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


def create_app(uploads_enabled=None, dist=DIST):
    if uploads_enabled is None:
        uploads_enabled = os.environ.get("LEADFLOW_DISABLE_UPLOADS") != "1"
    routes = [
        Route("/api/datasets", upload, methods=["POST"]),
        Route("/api/datasets/{dataset}", meta),
        Route("/api/datasets/{dataset}/view", view),
        Route("/api/datasets/{dataset}/inquiries/{inquiry_id}", inquiry_detail),
        Route("/api/datasets/{dataset}/exports/{kind}", export),
        Route("/api/samples/{name}", sample),
    ]
    if dist.is_dir():
        routes.append(Mount("/", StaticFiles(directory=dist, html=True)))
    app = Starlette(routes=routes, exception_handlers={HTTPException: http_error})
    app.state.store = Store()
    app.state.uploads_enabled = uploads_enabled
    return app
