All dashboard filters use **inquiry cohorts**: select inquiries by creation date, source, and service, then count their observed outcomes through the supplied snapshot. Date boundaries are inclusive UTC calendar dates. An outcome after the selected date range still counts if it belongs to a selected inquiry.

| Metric | Exact definition | Important interpretation |
|---|---|---|
| Inquiries | Count of unique accepted inquiry IDs | Exact duplicate rows removed; conflicting duplicates block import |
| Booked at least once | Inquiries with one or more bookings / inquiries | Repeat bookings count once; cancelled bookings still count as having converted |
| Average first response | Mean elapsed hours from inquiry to recorded first response | Missing responses excluded, never treated as zero; show coverage alongside mean |
| Response coverage | Inquiries with a recorded first response / inquiries | A missing timestamp may indicate missing data rather than no actual contact |
| Completed jobs | Count of accepted completed-job records for the cohort | One job per booking in v1; may exceed number of converted leads |
| Cancellation rate | Cancelled bookings / all bookings belonging to cohort | Includes scheduled bookings in denominator; no-shows reported separately |
| Recorded job revenue | Sum of completed-job revenue in USD | Job value only, not collected cash, profit, ROI, or uplift |
| Follow-up queue | No response, no booking, and age >=24 elapsed hours at snapshot | Calendar hours, including weekends; decision aid, not an automated contact list |
| Funnel final stage | Inquiries with at least one completed job | Counts leads rather than jobs so funnel stages use the same unit |
| Furthest outcome (flow view) | Per inquiry: completed job if any booking has a job; otherwise still scheduled if any booking is scheduled; otherwise cancelled/no-show if booked; otherwise never booked | One path per inquiry, so the flow totals equal the inquiry count; a lead with a completed and a cancelled booking appears as completed |
| Daily timeline | Inquiries created per UTC day, and how many of those inquiries booked or completed a job by the snapshot | Honors source/service filters, ignores the date range so the whole period stays visible for selection |

Empty denominators display N/A. Valid cohorts with zero jobs show zero jobs and $0 revenue. Lead source is attributed to the original inquiry; no multi-touch attribution is attempted.

The weekly brief uses the last fully completed Monday–Sunday week **before the snapshot's current week**, comparing inquiry count with the preceding week. It honors source/service filters but ignores the custom date range, as labeled in the UI. Outcomes for both cohorts are observed at the same snapshot. Recent cohorts have less time to book and finish jobs: comparisons describe this snapshot and are not causal evidence.

V1 cannot reconstruct historical booking statuses because the files contain only current status, not status-change events. The snapshot is the time represented by all three files, not an arbitrary time-travel control. Unfilled appointments require capacity/slot and replacement-booking data and are deliberately deferred. A cancellation is not automatically an unfilled appointment.
