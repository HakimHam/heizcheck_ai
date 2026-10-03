# 12: Confirm screen with the PDF alongside

**What to build:** The Property Manager confirms a whole Statement Package on a single screen. Each figure is shown next to the highlighted spot in the PDF where it appears, so checking takes minutes. See the spec: the Confirm user stories and the note on which fields the Confirm screen shows.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [x] Selecting a figure shows its PDF page with the source region highlighted.
- [x] One screen shows the Building Statement figures, the table of Unit Statements (Unit, area, consumption, amount, estimated) and all CO₂ fields.
- [x] Empty figures are clearly marked and can be filled in, and any figure can be corrected.
- [x] When the Building Profile is missing data a rule needs, the screen prompts the Property Manager to complete it.
- [x] One confirm action covers the whole package.
- [x] Highlighting works with the fake Extractor's source references, and with the real ones once 11 lands.
- [x] All text is in German.

## Comments

**2026-10-03 (implementation, branch `feature/ticket-claude_code_impl`):**

- The Confirm screen now has two columns: the figures on the left, the package's PDFs on the right (`PdfSourceViewer`, pdf.js `pdfjs-dist` 6). The PDF panel stays in view while scrolling. Below 1100px it sits above the form.
- Selecting a figure (focusing its field or clicking its "Datei · S. n" link) opens that PDF page and highlights the `bbox`. Selecting it again after paging away jumps back. The PDFs are read through signed storage links valid for one hour (`getPdfLinks`).
- `sourceOfField` (`src/lib/figure-sources.ts`) maps a form field to its source reference. It handles renamed fields (euros → cents) and falls back to the enclosing figure (a Billing Period, a Cost Item, the CO₂ split, a Unit Statement), never the whole statement. A test proves every field of the fake package has a source.
- **Contract for 11:** `SourceReference.file` must be the PDF's file name exactly as uploaded, because the viewer finds the PDF by name. `bbox` is `[x, y, w, h]` as fractions of the page from the top left.
- Figures not found are marked (dashed, "nicht gefunden") while they stay empty. A banner counts them per figure (`countNotFound`). Spare rows are not marked.
- The Building Profile prompt links straight to the profile form (`/gebaeude/<id>#gebaeudeprofil`).
- **Known limit:** the fake Extractor puts Unit i on page i+1 of the last PDF and the CO₂ figures on page 2 of the first. With a shorter PDF, the viewer says the page doesn't exist instead of highlighting.
- 2026-10-03, manual run: dev server, then a production build under `next start`, with a 3-page test PDF uploaded to Schillerstr. 17. Checked:
  - Highlights on pages 1–3.
  - The "page doesn't exist" message for page 5.
  - Re-selecting after paging away.
  - Empty marking as values are cleared.
  - The pdf.js worker is emitted and runs in the production build.

  That package is left `awaiting_confirmation`.
