-- Aggregate to ONE row per inquiry before computing conversion or response averages.
WITH job_totals AS (
    SELECT booking_id, count(*) AS jobs, sum(revenue_usd) AS revenue_usd
    FROM jobs GROUP BY booking_id
), booking_totals AS (
    SELECT b.inquiry_id, count(*) AS bookings,
        count(*) FILTER (WHERE b.status = 'cancelled') AS cancellations,
        count(*) FILTER (WHERE b.status = 'no_show') AS no_shows,
        sum(coalesce(j.jobs, 0)) AS completed_jobs,
        sum(coalesce(j.revenue_usd, 0)) AS revenue_usd
    FROM bookings b LEFT JOIN job_totals j USING (booking_id)
    GROUP BY b.inquiry_id
)
SELECT i.*,
    date_diff('second', i.created_at, i.first_response_at) / 3600.0 AS response_hours,
    coalesce(b.bookings, 0) AS bookings,
    coalesce(b.cancellations, 0) AS cancellations,
    coalesce(b.no_shows, 0) AS no_shows,
    coalesce(b.completed_jobs, 0) AS completed_jobs,
    coalesce(b.revenue_usd, 0) AS revenue_usd
FROM inquiries i LEFT JOIN booking_totals b USING (inquiry_id)
ORDER BY i.created_at
