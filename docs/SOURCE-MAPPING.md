# Source mapping worksheet

These example source labels are hypothetical. Replace them only after inspecting a permissioned export. No automated mapping or fuzzy ID matching is implemented.

| Target field | Hypothetical source field | Conversion / validation |
|---|---|---|
| inquiries.inquiry_id | Lead ID | Preserve stable unique string, including leading zeros |
| inquiries.created_at | Received time | ISO 8601 with explicit offset; do not guess timezone |
| inquiries.source | Acquisition channel | Map explicitly to supported categories; blank becomes unknown |
| inquiries.service | Requested service | Map to cleaning, handyman, landscaping |
| inquiries.first_response_at | First staff reply | Earliest actual reply; blank stays missing |
| bookings.booking_id | Appointment ID | Unique string; rescheduling keeps ID |
| bookings.inquiry_id | Originating Lead ID | Exact reference to inquiry; no name matching |
| bookings.booked_at | Appointment created | At/after inquiry creation |
| bookings.scheduled_at | Appointment start | At/after booking; future times allowed |
| bookings.status | Current outcome | scheduled, completed, cancelled, no_show |
| jobs.job_id | Work order ID | Unique completed-job ID |
| jobs.booking_id | Appointment ID | One job per completed booking |
| jobs.completed_at | Finished time | Actual completion, not invoice date |
| jobs.revenue_usd | Job value | Nonnegative USD amount with <=2 decimal places |

For each real source, record: export owner, system, file name, exact original header, source timezone, allowed values, mapping rule, sample anonymized value, and owner approval date. Unresolved mappings block import. Keep private examples in ignored data/private/, not this worksheet.

Before import, confirm the three files share a snapshot, required IDs survive export, completed bookings have job records, and all currencies are USD. See DATA-CONTRACT.md for exact column order and accepted values.
