# 03: Tracer bullet: upload → fake extraction → confirm → C1 → Check Report

**What to build:** The whole core flow end to end, with one real rule.

1. A Property Manager uploads a Statement Package (the Building Statement plus all Unit Statements for one Billing Period) with a Dispatch Date, which defaults to today.
2. A fake Extractor produces Extracted Figures in the full fixed schema.
3. The Property Manager sees the figures on a basic Confirm screen, can edit them, and confirms once for the whole package.
4. The check engine `checkPackage` runs and produces an immutable Check Report with one Check Result per rule. C1 is real, and the other ten rules return Not assessable ("not yet implemented").

This ticket sets up both test seams, the check engine and the Extractor interface, that every later ticket builds on. See the spec: modules 1, 4, 5 and 6, the Data shapes section and the C1 semantics.

**Blocked by:** 02 (Buildings and Building Profile).

**Status:** ready-for-agent

**Upload and extraction**

- [ ] Upload accepts multiple PDFs as one Statement Package for a building, plus a Dispatch Date (default today). Files that aren't PDFs are rejected with a message in German.
- [ ] Uploads for non-residential buildings are refused.
- [ ] PDFs are stored in Supabase storage (Frankfurt).
- [ ] The Extractor is an interface with an in-memory fake. The fake returns figures in the full `Figures` schema, including source references.
- [ ] The package moves through the states `uploaded → extracting → awaiting_confirmation → confirmed → checked`, and the user sees them as progress.

**Confirm**

- [ ] The Confirm screen shows the Building Statement figures and the table of Unit Statements.
- [ ] Every figure can be edited or filled in, and one confirm action covers the whole package.
- [ ] After confirming, the Confirmed Figures are stored as an immutable snapshot and can no longer be edited.

**Check engine**

- [ ] `checkPackage(Confirmed Figures, Building Profile, Dispatch Date)` is pure and deterministic, with no I/O and no clock.
- [ ] It returns exactly one Check Result per rule, in catalogue order, stamped with the Ruleset version.
- [ ] C1 is implemented: |Σ Unit amounts − building total| ≤ €0.05 × number of Units, with money in integer cents.
- [ ] A C1 Finding carries its legal reference, the affected Units, and the difference as the amount at stake.
- [ ] C1 tests cover a pass, a failure, a difference exactly at the tolerance, and missing figures (Not assessable).

**Check Report**

- [ ] The Check Report is stored append-only with the Confirmed Figures, a snapshot of the Building Profile, the Ruleset version and the Dispatch Date. Later Building Profile edits don't change it.
- [ ] The Check Report view lists every Check Result (Passed, Finding raised, or Not assessable with the reason), with Errors before Warnings.
