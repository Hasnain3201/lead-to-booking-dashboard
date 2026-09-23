# Owner workflow and requirements

## User and decisions

The primary user is the owner or operations coordinator of a home-service business. Every Monday they export three matching files, review the import receipt, check last week’s activity, assign unanswered inquiries for follow-up, inspect cancelled/no-show appointments, and compare sources by completed work. They download the brief for their weekly review.

| Decision | Evidence | Acceptance criterion |
|---|---|---|
| Who needs follow-up? | Unanswered, unbooked inquiries aged at least 24 hours | Every queue row traces to an inquiry and respects active filters |
| Where did bookings fail? | Cancelled and no-show bookings with original source/service | Outcome counts reconcile to overview; no vacant-slot claim |
| What happened to this lead? | Inquiry plus every linked booking and completed job | Repeat bookings remain separate; missing jobs remain empty |
| Which sources produced work? | Inquiry counts, conversions, jobs, and recorded revenue | Source totals reconcile to overall metrics; sample sizes visible |
| What should we review this week? | Last complete-week brief and explicit next action | All numbers trace to the supplied snapshot; no causal claims |

## Product decisions for version 1

- Response time uses elapsed hours, including nights and weekends. Business-hour calendars require a later owner decision.
- Reporting uses UTC. Input timestamps must contain an explicit timezone offset.
- Cancellation reporting follows inquiry cohorts, not appointment-date periods. Current status is observed at the supplied snapshot.
- A cancelled inquiry that booked once still counts as converted. No-shows are a separate booking outcome.
- The dashboard is read-only: assignment, customer contact, and source corrections happen outside it.
- The 24-hour follow-up threshold is a default that each business can revisit, not a negotiated service-level agreement.
- No names or contact information are needed for the analysis.

## Questions to confirm with each business

Confirm the owner’s reporting timezone, working hours, follow-up target, definition of a new inquiry versus repeat customer, cancellation handling, source categories, and interpretation of job value. Determine who owns each export and how they confirm all three reflect the same snapshot. Record each business's answers during setup.

## Acceptance walkthrough

Import the demo, reconcile accepted inquiry count to 720, isolate one source, open a cancelled booking’s inquiry, explain its other bookings, and download the filtered outcome list. Explain why missing responses are excluded from mean response time and why job value is not cash collected. See DEMO-GUIDE.md for the remaining browser checks.
