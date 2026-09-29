# 11: Bedrock extraction + eval

**What to build:** Real extraction replaces the fake in the running app. Claude Sonnet 5 turns a Statement Package's PDFs into Extracted Figures, as set out in ADR 0003:

- through Amazon Bedrock, in-Region in `eu-west-1`
- on the `bedrock-mantle` endpoint, with model `anthropic.claude-sonnet-5`
- with data retention set to `none`

The AI never judges the figures (ADR 0001). An eval measures extraction accuracy against real Minol packages. See the spec: module 4 and the testing decisions for Seam 2.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

**Adapter**

- [ ] A Bedrock adapter implements the Extractor interface and calls Bedrock in-Region in `eu-west-1`. Neither Sonnet 5.5 nor the Global profile is used.
- [ ] The fixed schema is enforced, with structured outputs if Bedrock supports them and otherwise with one strict tool. The result is validated with Zod.
- [ ] Output that fails validation is a failed extraction, never a partial one.

**Output**

- [ ] Figures the model can't find are null, not guessed.
- [ ] Every figure carries a source reference (file, page, region).
- [ ] Cost Item names are extracted exactly as written.
- [ ] The output schema has no verdict, severity or judgement fields.

**Failure and testing**

- [ ] A failed extraction sets the package to `extraction_failed`, shows an error in German and offers a retry.
- [ ] A contract test proves that malformed model output is rejected.
- [ ] An eval runs on demand, not in CI, against 5–10 anonymised Minol packages with hand-labelled figures, including the CO₂ fields and the printed area precision. It reports the share of correct figures, with a target of ≥ 95%.
- [ ] The fake Extractor stays available for tests and local development.
