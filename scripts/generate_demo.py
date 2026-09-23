"""Rebuild the sample workspace data. No personal information is generated."""

import csv
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = datetime(2026, 9, 21, tzinfo=timezone.utc)


def generate():
    rng = random.Random(42)
    inquiries, bookings, jobs = [], [], []
    sources = ["google_ads", "organic_search", "referral", "social", "walk_in"]
    chances = {
        "google_ads": 0.40,
        "organic_search": 0.58,
        "referral": 0.78,
        "social": 0.30,
        "walk_in": 0.66,
    }
    for n in range(1, 721):
        created = SNAPSHOT - timedelta(days=84) + timedelta(minutes=rng.randrange(84 * 1440))
        source = rng.choices(sources, weights=[35, 25, 20, 15, 5])[0]
        service = rng.choice(["cleaning", "handyman", "landscaping"])
        delay = rng.uniform(0.2, 10) if source == "referral" else rng.uniform(0.5, 42)
        response = created + timedelta(hours=delay)
        if rng.random() < 0.12 or response > SNAPSHOT:
            response = None
        inquiry_id = f"I{n:04}"
        # Controlled messiness: whitespace, category aliases, exact duplicate rows.
        raw_source = " Google " if source == "google_ads" and n % 17 == 0 else source
        inquiries.append(
            [
                inquiry_id,
                created.isoformat(),
                raw_source,
                service,
                response.isoformat() if response else "",
            ]
        )
        if response is None or rng.random() > chances[source]:
            continue
        booked = response + timedelta(hours=rng.uniform(0.2, 24))
        if booked > SNAPSHOT:
            continue
        for repeat in range(2 if n % 23 == 0 else 1):
            appointment = booked + timedelta(days=rng.randint(1, 9) + repeat * 10)
            booking_id = f"B{len(bookings) + 1:04}"
            status = rng.choices(["completed", "cancelled", "no_show"], [80, 15, 5])[0]
            completion = appointment + timedelta(hours=2)
            if completion > SNAPSHOT:
                status = "scheduled"
            bookings.append(
                [booking_id, inquiry_id, booked.isoformat(), appointment.isoformat(), status]
            )
            if status == "completed":
                revenue = {"cleaning": 160, "handyman": 240, "landscaping": 300}[service]
                jobs.append(
                    [
                        f"J{len(jobs) + 1:04}",
                        booking_id,
                        completion.isoformat(),
                        f"{revenue + rng.randint(-30, 90):.2f}",
                    ]
                )
    inquiries.extend([row.copy() for row in inquiries[:3]])
    columns = {
        "inquiries": ["inquiry_id", "created_at", "source", "service", "first_response_at"],
        "bookings": ["booking_id", "inquiry_id", "booked_at", "scheduled_at", "status"],
        "jobs": ["job_id", "booking_id", "completed_at", "revenue_usd"],
    }
    target = ROOT / "data" / "demo"
    target.mkdir(parents=True, exist_ok=True)
    for name, rows in [("inquiries", inquiries), ("bookings", bookings), ("jobs", jobs)]:
        with (target / f"{name}.csv").open("w", newline="") as file:
            writer = csv.writer(file)
            writer.writerow(columns[name])
            writer.writerows(rows)
    (target / "manifest.json").write_text(
        json.dumps(
            {
                "business": "Sample workspace",
                "sample": True,
                "seed": 42,
                "snapshot": SNAPSHOT.isoformat(),
                "inquiries": 720,
                "bookings": len(bookings),
                "jobs": len(jobs),
            },
            indent=2,
        )
        + "\n"
    )
    invalid = ROOT / "data" / "invalid"
    invalid.mkdir(exist_ok=True)
    with (invalid / "bookings_orphan.csv").open("w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(columns["bookings"])
        writer.writerows(
            bookings
            + [
                [
                    "B_ORPHAN",
                    "I_DOES_NOT_EXIST",
                    "2026-09-01T10:00:00Z",
                    "2026-09-02T10:00:00Z",
                    "cancelled",
                ]
            ]
        )
    print(f"Generated 720 unique inquiries, {len(bookings)} bookings, {len(jobs)} jobs.")


if __name__ == "__main__":
    generate()
