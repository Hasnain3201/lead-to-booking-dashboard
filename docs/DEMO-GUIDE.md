# Three-minute demo

1. **Problem:** “An owner receives inquiries, books appointments, and records finished jobs in different spreadsheets. They need to see where follow-up is missing.”
2. **Data quality:** Open the Data quality tab. Explain the three duplicate inquiries removed and source labels normalized. There are 720 unique inquiries, not 723.
3. **Overview:** Explain what “Booked at least once” means. Show the funnel. Mention that repeat bookings do not inflate conversion.
4. **Sources:** Compare completed jobs by source. Explain that the dataset intentionally favors referrals; this is a demonstration, not a market finding or causal proof.
5. **Action:** Open Needs attention. Explain the 24-hour rule and why missing timestamps deserve review before contacting anyone.
6. **Handoff:** Download the weekly brief. Explain what the owner should review next and where every number comes from.

## Hands-on acceptance checklist

- [ ] Launch by double-clicking the command file on the owner's computer.
- [ ] Check chart labels and tabs at desktop and narrow browser widths.
- [ ] Change source/service/date filters and reconcile totals against downloaded records.
- [ ] Download all three sample CSVs and import them together with snapshot date 2026-09-21.
- [ ] Replace bookings with `data/invalid/bookings_orphan.csv`; confirm clear rejection and no dashboard metrics.
- [ ] Correct the bundle and confirm successful recovery.
- [ ] Open downloaded CSVs in a spreadsheet viewer and verify columns and counts.
- [ ] Have another person explain conversion, response coverage, and cancellation rate.
- [ ] Record actual user feedback and changes made in response.

Automated tests cover much of the underlying logic. Check these boxes only after actually completing these user-facing steps; do not infer them from test success.
