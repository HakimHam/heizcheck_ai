# 13: Check Report PDF export

**What to build:** A Property Manager can export any stored Check Report as a PDF in German, to file it or send it to the Metering Provider. See the spec: module 6.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [x] The export renders the stored Check Report and never recomputes it.
- [x] The PDF lists every Check Result. For each Finding it shows the Severity, legal reference, affected Units and amount at stake, with Errors before Warnings.
- [x] The PDF shows the building, the Billing Period, the Dispatch Date, the Ruleset version and when the Check Report was created.
- [x] The PDF includes the disclaimer.
- [x] All text is in German.

## Comments

**2026-10-03 (implementation, branch `feature/ticket-claude_code_impl`):**

- "Als PDF herunterladen" on the Check Report links to `GET /pakete/<id>/pruefbericht`. The route returns the stored Check Report as an A4 PDF download. It returns 404 for packages without a report or from other Organisations (RLS), and the proxy sends signed-out visitors to sign in.
- `renderCheckReportPdf` (`src/lib/check-report-pdf.tsx`, `@react-pdf/renderer`) renders the stored row only: the results, the Billing Period from the Confirmed Figures snapshot, the Dispatch Date, the Ruleset version and the creation time. It never calls the check engine.
  - Same order and wording as the web view. The labels now live in `check-report.ts` and both use them.
  - The disclaimer sits under the header on page 1.
  - Every page carries a footer with page numbers.
- **Fonts:** the PDF standard fonts have no "₂" (CO₂), so Noto Sans is embedded from `assets/fonts/` (SIL OFL licence alongside). `next.config.ts` traces it into the route. Hyphenation is off, because react-pdf would split German words with English patterns.
- **Testing:** `check-report-pdf.test.ts` renders a report and reads the text back with pdf.js, asserting each acceptance criterion. The spec says PDF rendering is covered manually, so this goes beyond it.
- **Manual run, 2026-10-03, production build under `next start`:** downloaded the report of the checked Walkstr. 11 package. Result: 200, `application/pdf`, about 24 KB. Unknown ids gave 404, and a signed-out request was redirected to `/anmelden`. Rendered pages were checked by eye, including a 4-page report.
- **Open points for review:**
  - The address comes from the building's current row, because Check Reports don't snapshot it. If the address is edited later, old exports show the new one.
  - "Errors before Warnings" follows `orderForReport` from #03. Rules with an Error come first, and Errors come before Warnings within a rule. A rule's Warning can still come before another rule's Error.
