# Three-minute demo

1. **Problem (hero):** “An owner receives inquiries, books appointments, and records finished jobs in different spreadsheets. They can't see where follow-up is missing.” Point at the gauge: 45.6% of the 720 inquiries in the sample workspace booked at least once.
2. **The current:** “Every dot is one inquiry.” Show leads leaking out at *Never booked* and the coral *No response recorded* band. Click **Referrals** to focus the whole dashboard, then click again to restore it. Click any dot to open its record.
3. **Tide chart:** Drag across the last four weeks. Explain that dates select when inquiries *arrived*, and recent days have had less time to book.
4. **Sources:** Switch between *Volume*, *Booked*, and *Response*. Point out the sample sizes and the caveat that source differences describe this snapshot, not cause and effect.
5. **Needs attention:** Seventy-three leads have had no reply and no booking for more than 24 hours. Open the oldest one and walk through its record. Mention that the dashboard sends nothing.
6. **Trust:** In *Data intake*, show the receipt: three duplicate inquiries removed, 720 accepted. Click **Load a broken sample → Validate and import** to show the import stop with a row-level issue and no metrics left on screen, then return to the demo.
7. **Handoff:** Show the weekly dispatch and download it. Every sentence comes from fixed rules and traces to a visible number.

## Hands-on acceptance checklist

Items marked with a date were performed in a real browser against the running app. Check the others only after doing them yourself.

- [x] Launch the app from `serve.py` and load the sample workspace. *(Sep 23, 2026)*
- [ ] Launch by double-clicking `open-dashboard.command` on the owner's computer.
- [x] Review layout at 1440 px desktop, in the day theme, and at 390 px mobile. *(Sep 23, 2026, headless Chrome captures)*
- [x] Change source, service, and date filters and confirm the inquiry count updates (720 → 260 for Google Ads only → 720; end date two weeks earlier → 668). *(Sep 23, 2026)*
- [x] Import all three sample CSVs through the upload form; confirm 720 inquiries and the *Uploaded* labels. *(Sep 23, 2026)*
- [x] Replace bookings with `data/invalid/bookings_orphan.csv`; confirm one orphan-ID issue at bookings row 347 and no dashboard metrics. *(Sep 23, 2026)*
- [x] Correct the bundle and confirm successful recovery. *(Sep 23, 2026)*
- [x] Click a particle in the flow view and confirm the drawer opens the same inquiry. *(Sep 23, 2026)*
- [ ] Complete the whole walkthrough using only the keyboard (Tab, Enter, arrow keys, Escape).
- [ ] Open downloaded CSVs in a spreadsheet app and verify columns and counts against the screen.
- [ ] Turn on the operating system's reduce-motion setting and confirm the particle current starts paused.
- [ ] Have another person explain conversion, response coverage, and cancellation rate.
- [ ] Record actual user feedback and the changes made in response.

Automated tests cover the underlying logic and API parity. They do not replace these user-facing checks.

## Usability review template

Ask a friend or stakeholder to complete three tasks without help, and record what happens:

| Task | Completed? | Time | Where they hesitated | What they said |
|---|---|---|---|---|
| Find an inquiry that is still waiting for a first response | | | | |
| Name a lead source that produced completed jobs, and its sample size | | | | |
| Explain what the cancellation rate is out of | | | | |

Afterward, note each misunderstanding and the change made because of it. This is the evidence that matters when improving the product.
