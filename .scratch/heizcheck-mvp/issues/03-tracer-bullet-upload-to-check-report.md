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

- [x] Upload accepts multiple PDFs as one Statement Package for a building, plus a Dispatch Date (default today). Files that aren't PDFs are rejected with a message in German.
- [x] Uploads for non-residential buildings are refused.
- [x] PDFs are stored in Supabase storage (Frankfurt).
- [x] The Extractor is an interface with an in-memory fake. The fake returns figures in the full `Figures` schema, including source references.
- [x] The package moves through the states `uploaded → extracting → awaiting_confirmation → confirmed → checked`, and the user sees them as progress.

**Confirm**

- [x] The Confirm screen shows the Building Statement figures and the table of Unit Statements.
- [x] Every figure can be edited or filled in, and one confirm action covers the whole package.
- [x] After confirming, the Confirmed Figures are stored as an immutable snapshot and can no longer be edited.

**Check engine**

- [x] `checkPackage(Confirmed Figures, Building Profile, Dispatch Date)` is pure and deterministic, with no I/O and no clock.
- [x] It returns exactly one Check Result per rule, in catalogue order, stamped with the Ruleset version.
- [x] C1 is implemented: |Σ Unit amounts − building total| ≤ €0.05 × number of Units, with money in integer cents.
- [x] A C1 Finding carries its legal reference, the affected Units, and the difference as the amount at stake.
- [x] C1 tests cover a pass, a failure, a difference exactly at the tolerance, and missing figures (Not assessable).

**Check Report**

- [x] The Check Report is stored append-only with the Confirmed Figures, a snapshot of the Building Profile, the Ruleset version and the Dispatch Date. Later Building Profile edits don't change it.
- [x] The Check Report view lists every Check Result (Passed, Finding raised, or Not assessable with the reason), with Errors before Warnings.

## Comments

**2026-10-02 (implementation, branch `feature/ticket-claude_code_impl`):**

- Seams: `checkPackage` in `src/lib/check-engine/` (C1 real, the other ten "noch nicht umgesetzt"; Ruleset version `0.1.0`) and the `Extractor` interface in `src/lib/extractor/` with `createFakeExtractor()`. The app uses the fake (a six-Unit demo package) until ticket 11.
- Figures are stored as plain JSON: dates are `YYYY-MM-DD` strings, not `Date`. Source references sit beside the figures as `sources`, keyed by figure path (`units.2.amountCents`).
- Migration `20261002100000_statement_packages.sql`: packages, their PDFs, append-only `check_reports`, the `statement-packages` bucket and its storage policies. Triggers enforce the lifecycle order. They also refuse non-residential buildings and lock the Confirmed Figures. `confirm_statement_package` confirms and stores the Check Report in one transaction; nothing else can confirm. Proven by `supabase/tests/statement-package.test.ts`. **Not applied to the Supabase project yet.**
- The browser uploads PDFs straight to storage through signed upload URLs, so packages don't hit Vercel's request size limit. The browser checks for `%PDF-`, and extraction checks again on the server.
- An extraction stuck in `extracting` for more than 5 minutes can be restarted.
- The Confirm screen has one spare row each for Cost Items and Units, for anything the Extractor missed.
- **Known limit:** the database checks a Check Report's Confirmed Figures and its Building Profile snapshot, but it can't rerun the rules. A member calling the RPC directly could store results of their own. Members are trusted within their Organisation.
- `vitest.config.ts` now runs test files serially. Several PGlite databases booting in parallel timed out or crashed workers; this happened before this ticket too.
- Story 17's other scope conditions (no central heating, fewer than 3 Units) are still not captured. Only non-residential is refused.
