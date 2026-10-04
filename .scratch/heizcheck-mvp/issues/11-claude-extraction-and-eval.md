# 11: Claude extraction (dev route) + eval

**What to build:** Real extraction replaces the fake in the running app. Claude Sonnet 5 turns a Statement Package's PDFs into Extracted Figures. One `ClaudeExtractor` owns the prompt, the tool schema, the request and the Zod validation. It runs over a pluggable transport:

- **Anthropic API** (this ticket): `@anthropic-ai/sdk`, model `claude-sonnet-5`. For local development and the eval only, with synthetic or anonymised PDFs. Never with real Tenant data, and blocked in production.
- **Amazon Bedrock** in-Region in `eu-west-1` (ticket 17): the production route set out in ADR 0003.

The AI never judges the figures (ADR 0001). An eval measures extraction accuracy. See the spec: module 4 and the testing decisions for Seam 2.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

**First: check the text layer**

- [x] Check the Minol Musterabrechnung with `scripts/check-text-layer.mjs`. Result (2026-10-04): both samples have a text layer, but it is scrambled: the fonts have no character mapping, so amounts read as `WYX e eU`. `pdftotext` gives the same output.
- [ ] Run the script on one real Minol statement (locally; report only the summary). The result decides whether ticket 18 (OCR) is needed.

**Adapter**

- [ ] `ClaudeExtractor` implements the Extractor interface and takes a transport (client + model ID). The Anthropic transport uses `claude-sonnet-5`. Neither Sonnet 5.5 nor any non-EU route is used for production.
- [ ] The fixed schema comes back through one tool with `strict: true` and `tool_choice: auto`, on both transports. No structured outputs (`output_config.format`), because Bedrock doesn't support them for Sonnet 5. The request uses nothing the Bedrock `bedrock-mantle` endpoint lacks (no Files API, no server-side fallbacks).
- [ ] All of a package's PDFs go in one request as base64 `document` blocks, each preceded by a text label with its exact uploaded file name. A package over the API limits (32 MB, 600 pages) is a failed extraction.
- [ ] The tool input is validated with Zod. Output that fails validation is a failed extraction, never a partial one.

**Output**

- [ ] Figures the model can't find are null, not guessed.
- [ ] Every figure carries a source reference: `file`, `page` and `quote` (the text exactly as printed). Zod rejects a `file` that isn't one of the uploaded file names (ticket 12's contract).
- [ ] A bbox locator, behind its own interface so OCR (ticket 18) can be added later, works out `bbox` by finding `quote` in the page's pdf.js text layer. If the text layer is scrambled or the quote isn't found, the reference keeps its page and has no `bbox`, and the Confirm screen shows the page without a highlight. Claude itself still reads the page image, so extraction doesn't depend on the text layer.
- [ ] Cost Item names are extracted exactly as written.
- [ ] The output schema has no verdict, severity or judgement fields.

**Choosing the extractor**

- [ ] `appExtractor()` reads `EXTRACTOR=fake|anthropic|bedrock`, defaulting to `fake`. `bedrock` throws "not implemented" until ticket 17.
- [ ] Extraction throws when `EXTRACTOR=anthropic` and `VERCEL_ENV=production`. A test proves it.
- [ ] While `EXTRACTOR=anthropic`, the upload and Confirm screens show a German banner, e.g. "Entwicklungsmodus: Extraktion über Anthropic-API (USA) – keine echten Mieterdaten hochladen".
- [ ] The README explains `ANTHROPIC_API_KEY` and `EXTRACTOR` in `.env.local`, and that the key must never be set in Vercel production.

**Failure and testing**

- [ ] A failed extraction sets the package to `extraction_failed`, shows an error in German and offers a retry.
- [ ] A contract test proves that malformed model output is rejected.
- [ ] The fake Extractor stays available for tests and local development.

**Eval**

- [ ] `npm run eval` runs on demand, not in CI. It reads gitignored fixtures from `eval/fixtures/<package>/` (the PDFs plus `expected.json`).
- [ ] A figure counts as correct only on an exact match after normalising: amounts in cents, area at the printed precision, Cost Item names exactly, and an expected `null` met with `null`.
- [ ] It reports the overall share of correct figures (target ≥ 95%) and a breakdown per field, so the CO₂ fields show separately.
- [ ] A generator (`npm run make-fixture`) renders synthetic packages from a JSON of made-up figures through an HTML template in the Minol layout and headless Chrome. The same JSON becomes `expected.json`. Synthetic packages vary on purpose: Unit count, estimated readings, CO₂ present, missing or reduced, area precision, Cost Item wording, missing figures and planted mistakes. Some packages are image-only (pages rendered as pictures, no usable text), because the Minol Muster's text layer is scrambled and the eval must cover that case.
- [ ] Synthetic results are reported as synthetic. The ≥ 95% target for MVP acceptance (ticket 16) needs real, properly redacted packages, run through ticket 17's Bedrock route.

## Comments

**2026-10-04 (rescoped):** Split from the original "Bedrock extraction + eval". We don't have AWS access yet, so this ticket builds the shared extraction core on the Anthropic API as a dev and eval route. The Bedrock transport, the retention checks and the production eval moved to ticket 17. ADR 0003 still stands: production extraction runs only through Bedrock in `eu-west-1`. Decisions:

- One adapter with two transports, so the eval measures the code that will run in production.
- Sonnet 5 on both transports, not 5.5, so eval results carry over.
- A strict tool on both transports, so they behave the same.
- Source references use `quote` plus a code-computed `bbox`, because model-estimated coordinates aren't reliable.

**2026-10-04 (text layer):** The Minol Muster's text layer is scrambled, so the quote-matching bbox locator can't find anything on it. Decisions:

- Use the text layer when it reads cleanly. Otherwise give a page-only reference; the Confirm screen already works without a box.
- OCR is ticket 18, done only if a real Minol statement turns out scrambled too.
- Some synthetic eval packages are image-only, so the eval doesn't overstate accuracy.

Redaction warning for fixtures: black boxes drawn in a PDF editor leave the text layer intact, and the text layer is what gets sent. Use real redaction and check the result with the text-layer script.
