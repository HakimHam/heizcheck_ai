# 18: OCR bbox locator for PDFs without a readable text layer

**What to build:** When a PDF's text layer is scrambled or missing, highlight boxes still appear on the Confirm screen. Each page is rendered to an image and read with OCR (e.g. `tesseract.js` with German). The figure's `quote` is then found in the OCR result, which gives its `bbox`. It plugs into ticket 11's bbox locator as a second strategy after the pdf.js text layer. No AI is involved: the box comes from repeatable code.

**Blocked by:** 11 (Claude extraction + eval). Only worth doing if a real Minol statement's text layer turns out scrambled, like the Muster's (ticket 11, first task).

**Status:** needs-info

- [ ] The locator tries the pdf.js text layer first and falls back to OCR only when that yields nothing.
- [ ] OCR runs locally on the server, with no extra provider, so no new sub-processor is added.
- [ ] Amounts are matched despite OCR noise in German number formats (`1.234,56`, `78,40 m²`).
- [ ] If OCR doesn't find the quote either, the reference stays page-only.
- [ ] Measure how long OCR takes for a typical package and note it under Comments. If it's slow, it runs in the background after extraction rather than holding up the Confirm screen.
- [ ] Tested on the Minol Muster and on the image-only synthetic packages.
