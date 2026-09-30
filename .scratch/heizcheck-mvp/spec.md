# Spec: HeizCheck MVP

Status: ready-for-agent

Source: `docs/mvp-scope.md`. Terms are defined in `CONTEXT.md`. Decisions are in `docs/adr/` 0001–0003.

## Problem Statement

A Property Manager of rental buildings gets heating cost statements from their Metering Provider (Minol) and passes them on to Tenants. Today they have no practical way to check a Statement Package before sending it. Checking whether the Unit amounts add up, whether the consumption share is lawful under HeizkostenV, whether the CO₂ cost split follows the CO2KostAufG tier, or whether the §556 para 3 BGB deadline is at risk means working through dozens of PDFs by hand. That work needs legal knowledge most staff don't have. Mistakes reach Tenants, and so do objections. When a Tenant or the Metering Provider pushes back, the Property Manager can't point to a specific paragraph and a specific € amount to defend the statement or back up a complaint.

## Solution

The Property Manager uploads one Statement Package (the Building Statement plus all Unit Statements for one Billing Period) and gives the Dispatch Date. The AI reads the PDFs into Extracted Figures in a fixed schema, and judges nothing (ADR 0001). The Property Manager checks and corrects those figures on a single Confirm screen, where each figure sits next to the place it appears in the PDF. Fixed, deterministic rules then run on the Confirmed Figures together with the building's Building Profile. The result is an unchangeable Check Report with one Check Result per rule: Passed, Finding raised, or Not assessable (with the reason). Each Finding carries its Severity, its legal reference, the affected Units and the € amount at stake where that can be quantified. The Check Report can be exported as a PDF. The UI is in German and shows a clear disclaimer that HeizCheck gives evidence-backed checking, not a guarantee of legal correctness.

## User Stories

### Organisation and access

1. As a Property Manager, I want to sign in to my Organisation's HeizCheck account, so that I can check my buildings' statements.
2. As a Property Manager, I want every colleague in my Organisation to have the same rights as me, so that we don't need to manage roles.
3. As a Property Manager, I want to see all of my Organisation's buildings and nothing from other Organisations, so that client data stays separate.
4. As a Property Manager, I want to invite colleagues into my Organisation, so that the team can share the checking work.
5. As a Property Manager, I want to download a data processing agreement (AV-Vertrag) for my Organisation, so that I can meet my GDPR obligations before uploading Tenant data.
6. As a Property Manager, I want the whole interface in German, so that my staff can use it without translation.
7. As a Property Manager, I want a visible disclaimer that HeizCheck checks against evidence but does not guarantee legal correctness, so that I understand what I'm relying on.

### Buildings and Building Profile

8. As a Property Manager, I want to create a building with its address, so that I can file Statement Packages under it.
9. As a Property Manager, I want to record the building's living area in its Building Profile, so that the CO₂ intensity can be calculated.
10. As a Property Manager, I want to record the building's heated area in its Building Profile, so that the Unit areas on the heating cost statement can be checked against the matching total.
11. As a Property Manager, I want to record whether §7 para 1 sentence 2 HeizkostenV (mandatory 70% consumption share) applies to the building, so that the heating split is checked against the right requirement.
12. As a Property Manager, I want to record whether the building is residential, so that HeizCheck refuses buildings it doesn't cover.
13. As a Property Manager, I want to record whether the building is heritage-protected or must use district heating, so that a reduced landlord CO₂ share under §9 CO2KostAufG is not flagged as wrong.
14. As a Property Manager, I want the Building Profile to be reused across Billing Periods, so that I enter it only once.
15. As a Property Manager, I want to edit the Building Profile, so that I can correct it when facts change.
16. As a Property Manager, I want editing the Building Profile to leave existing Check Reports unchanged, so that past reports still show what they were based on.
17. As a Property Manager, I want HeizCheck to refuse to check buildings outside its scope (non-residential, no central heating, fewer than 3 Units), so that I don't rely on it where it doesn't apply.
18. As a Property Manager, I want a list of my buildings with their Billing Periods and the latest Check Report status, so that I can see what still needs checking.

### Upload

19. As a Property Manager, I want to upload all of a building's PDFs for one Billing Period as one Statement Package, so that the whole package is checked together.
20. As a Property Manager, I want to give the Dispatch Date when I upload, defaulting to today, so that the §556 deadline is checked against when I actually send.
21. As a Property Manager, I want to be told when a file isn't a readable PDF, so that I can upload the right file.
22. As a Property Manager, I want to see progress while extraction runs, so that I know the system is working.
23. As a Property Manager, I want to be told clearly if extraction fails, and be able to retry, so that a temporary error doesn't lose my upload.

### Extraction

24. As a Property Manager, I want the AI to read the Building Statement's total costs per Cost Item, so that I don't have to type them.
25. As a Property Manager, I want the AI to read the consumption/base split in % for heating and for hot water, and the allocation method used, so that the split and estimation rules can run.
26. As a Property Manager, I want the AI to read the total area, the fuel used and the total CO₂ emissions in kg, so that the CO₂ rules can run.
27. As a Property Manager, I want the AI to read the kg CO₂/m²/year, the tier, the landlord/tenant CO₂ split, the CO₂ cost and any claimed reduction exactly as the statement gives them, so that each can be checked against the law.
28. As a Property Manager, I want the AI to read each Unit Statement's Unit, area, consumption, amount, Billing Period and whether its readings were estimated, so that the consistency and estimation rules can run.
29. As a Property Manager, I want the AI to record how many decimals the areas are printed with, so that rounding in the statement doesn't cause false alarms.
30. As a Property Manager, I want Cost Item names extracted exactly as Minol wrote them, so that the mapping to Eligible Cost Types stays traceable.
31. As a Property Manager, I want a figure the AI couldn't find to be left empty rather than guessed, so that missing data shows up as Not assessable instead of a false Passed.
32. As a Property Manager, I want every Extracted Figure to record which PDF page and region it came from, so that I can check it at a glance.

### Confirm

33. As a Property Manager, I want to confirm all figures for a package on a single screen, so that confirmation takes minutes, not an afternoon.
34. As a Property Manager, I want each figure shown next to the spot in the PDF where it appears, so that I can check it without searching.
35. As a Property Manager, I want the Unit Statements shown as a table (Unit, area, consumption, amount, estimated), so that I can scan them quickly.
36. As a Property Manager, I want the CO₂ figures the statement gives (total kg, kg/m²/year, tier, split, cost, claimed reduction) on the Confirm screen, so that I can check what the CO₂ rules will run on.
37. As a Property Manager, I want to correct any Extracted Figure before confirming, so that the rules run on correct data.
38. As a Property Manager, I want to fill in a figure the AI left empty, so that the relevant rule can still be assessed.
39. As a Property Manager, I want to confirm once for the whole package, so that I don't approve figures one by one.
40. As a Property Manager, I want Confirmed Figures to be locked after confirming, so that the Check Report matches exactly what I approved.
41. As a Property Manager, I want to be prompted to complete the Building Profile if it's missing data, so that fewer rules come back Not assessable.

### Check and Check Report

42. As a Property Manager, I want the check to run automatically after I confirm, so that I get the Check Report straight away.
43. As a Property Manager, I want exactly one Check Result for every rule in the Ruleset, so that I can see what was checked, not only what failed.
44. As a Property Manager, I want every Check Result to be Passed, Finding raised or Not assessable with a reason, so that nothing is silently skipped.
45. As a Property Manager, I want each Finding to show its Severity (Error or Warning), so that I know which ones are definite breaches and which need my judgement.
46. As a Property Manager, I want each Finding to cite its legal paragraph, so that I can defend it to a Tenant or the Metering Provider.
47. As a Property Manager, I want each Finding to name the affected Units, so that I know which Unit Statements are wrong.
48. As a Property Manager, I want each Finding to show the € amount at stake where it can be quantified, so that I can prioritise.
49. As a Property Manager, I want Findings with the Error Severity listed before Warnings, so that the definite problems come first.
50. As a Property Manager, I want the Check Report to record the Confirmed Figures, the Building Profile and the Ruleset version it was based on, so that I can reproduce it later.
51. As a Property Manager, I want the Check Report to be unchangeable, so that it holds up as evidence.
52. As a Property Manager, I want to export the Check Report as a PDF, so that I can file it or send it to the Metering Provider.
53. As a Property Manager, I want the PDF export to include the disclaimer, so that recipients understand what it is.

### Rules (what the Property Manager expects each to catch)

54. As a Property Manager, I want to be told (C1) when the Unit amounts don't add up to the building total within ±€0.05 per Unit, so that no money is lost or charged twice.
55. As a Property Manager, I want to be told (C2) when the Unit areas don't add up to the heated area, allowing for how precisely the areas are printed, so that area-based shares are right without false alarms from rounding.
56. As a Property Manager, I want to be told (C3) when any statement in the package has a different Billing Period, so that I don't send a mixed package.
57. As a Property Manager, I want to be told (H1) when the heating consumption share is outside 50–70%, or isn't exactly 70% where my Building Profile says §7 para 1 sentence 2 applies, so that the split is lawful.
58. As a Property Manager who hasn't set the §7 para 1 sentence 2 flag, I want a Warning that exactly 70% may be required, so that I check it for older oil and gas buildings.
59. As a Property Manager, I want to be told (H2) when the hot water consumption share is outside 50–70%, so that the split is lawful under §8 HeizkostenV.
60. As a Property Manager, I want every Cost Item checked against the Eligible Cost Types (H3), with ineligible items raised as Errors and unrecognised items as Warnings, so that Tenants aren't charged for costs that can't be passed on.
61. As a Property Manager, I want to be told (H4) when readings were estimated for more than 25% of the area but the statement still splits by consumption, so that I know it must be split by area only.
62. As a Property Manager, I want a Warning (H5) whenever any readings were estimated, so that I can check the estimates are justified.
63. As a Property Manager, I want to be told (K1) when the landlord/tenant CO₂ split doesn't match the CO2KostAufG tier for the building's kg CO₂/m²/year, so that Tenants don't carry the landlord's share.
64. As a Property Manager of a heritage-protected building or one that must use district heating, I want K1 to accept the reduced landlord share §9 CO2KostAufG allows, so that a lawful statement isn't flagged.
65. As a Property Manager, I want to be told when the kg CO₂/m²/year or the tier the statement gives doesn't match what the figures produce, so that I can challenge the Metering Provider's calculation.
66. As a Property Manager, I want K1 to return Not assessable for Billing Periods starting before 1 Jan 2023 or on or after 1 Jan 2028, so that I'm not given a result the Ruleset can't back.
67. As a Property Manager, I want a Warning (K2) when the statement contains no CO₂ data at all, telling me the Tenant may cut their heating costs by 3%, so that I request the data from the Metering Provider before sending.
68. As a Property Manager, I want an Error (B1) when the Dispatch Date is after the Billing Period end + 12 calendar months, and a Warning when fewer than 4 weeks are left, so that I don't miss the §556 para 3 BGB deadline.

### Corrected packages and history

69. As a Property Manager, I want to upload a corrected Statement Package for the same building and Billing Period, so that I can check what Minol sent after my complaint.
70. As a Property Manager, I want the corrected package to supersede the previous one, so that it's clear which one is current.
71. As a Property Manager, I want the Superseded Package and its Check Report kept and viewable, so that I can show what was wrong originally.
72. As a Property Manager, I want to see all packages and Check Reports for a building and Billing Period in order, so that I can follow the correction history.

### Data protection and retention

73. As a Property Manager, I want all data hosted in the EU and the AI run in an EU region without training on my data, so that Tenant personal data is GDPR-compliant.
74. As a Property Manager, I want PDFs and Check Reports kept for 4 years and then deleted automatically, so that I keep evidence through the objection window and limitation period without holding data longer than needed.

## Implementation Decisions

### Stack (ADR 0003)

- Next.js on Vercel (EU region). Supabase in Frankfurt for auth, Postgres and PDF storage.
- Extraction uses Claude Sonnet 5 through Amazon Bedrock in-Region in `eu-west-1`, on the `bedrock-mantle` endpoint with model `anthropic.claude-sonnet-5` and account data retention `none`. Do not use Sonnet 5.5; it is Global-only.
- If structured outputs are rejected, enforce the fixed schema through a single strict tool and validate the result with Zod. Output that fails validation is a failed extraction, never a partial one.
- The rules are plain TypeScript pure functions (ADR 0001, ADR 0003).

### Modules

1. **Check engine (deep module; test seam 1).** The single entry point is `checkPackage(input) → CheckReportContent`, where `input` holds the Confirmed Figures, the Building Profile and the Dispatch Date. It is pure and deterministic, with no I/O and no clock (the Dispatch Date is passed in). It returns exactly one Check Result per rule, in catalogue order, and stamps the Ruleset version. Each rule is an internal function over the same input; the rule list and Ruleset version are constants inside the module. Money is handled in integer cents, and percentages and areas are handled as decimals with explicit tolerances. Floats are never compared for equality.
2. **Eligible Cost Types and the Minol mapping.** A fixed list of Eligible Cost Types derived from §7 para 2 HeizkostenV (fuel and its delivery, operating power, operation/supervision/maintenance of the system, regular testing and cleaning, chimney sweep, cleaning the room where the system stands, measuring equipment rental or other use, use of metering and the billing by the Metering Provider, including measuring data), and a mapping table from Minol Cost Item names to that list. Both live inside the check engine and are versioned with the Ruleset. H3 looks up names after normalising whitespace and case. A name that maps to "not eligible" is an Error, and a name not in the table is a Warning.
3. **CO₂ tier table.** A constant inside the check engine, versioned with the Ruleset, taken from the CO2KostAufG annex (BGBl. I 2022, 2159). Each tier includes its lower limit and excludes its upper one. The statute lists the tenant column first; store the shares as named fields, never as positional pairs, so the two can't be swapped.

   | kg CO₂/m²/year | Tenant | Landlord |
   |---|---|---|
   | < 12 | 100% | 0% |
   | 12 to < 17 | 90% | 10% |
   | 17 to < 22 | 80% | 20% |
   | 22 to < 27 | 70% | 30% |
   | 27 to < 32 | 60% | 40% |
   | 32 to < 37 | 50% | 50% |
   | 37 to < 42 | 40% | 60% |
   | 42 to < 47 | 30% | 70% |
   | 47 to < 52 | 20% | 80% |
   | ≥ 52 | 5% | 95% |

4. **Extractor (test seam 2).** An interface `extract(statementPackagePdfs) → ExtractedFigures`, with a Bedrock adapter and an in-memory fake. The adapter owns the prompt, the tool schema and Zod validation. It extracts only what the statement states, including the Metering Provider's own CO₂ tier and any claimed reduction, and never produces a verdict, severity or judgement field (ADR 0001).
5. **Statement Package service.** Handles upload, storage, supersession and the lifecycle `uploaded → extracting → awaiting_confirmation → confirmed → checked`, plus `extraction_failed` with retry. Confirming stores the Confirmed Figures as an immutable snapshot and calls the check engine, then persists the Check Report.
6. **Check Report store and PDF export.** Check Reports are append-only rows. Each one holds the snapshot of the Confirmed Figures, the Building Profile snapshot, the Ruleset version, the Dispatch Date, the Check Results and its creation time. Nothing updates or deletes a Check Report except the retention job. The PDF export renders a stored Check Report in German, including the disclaimer.
7. **Building and Building Profile.** CRUD per Organisation. The Building Profile holds facts the Metering Provider doesn't supply: living area, heated area, the §7 para 1 sentence 2 HeizkostenV flag, whether the building is residential, and whether it is heritage-protected or must use district heating (§9 CO2KostAufG). The Building Profile holds the true values; the Extracted Figures hold only what the statement claims, and rules compare the two. A building marked non-residential is refused at upload (out of scope), so there is no §8 CO2KostAufG 50/50 path. Each Check Report copies the Building Profile into its snapshot, so later edits don't affect it.
8. **Organisation and access.** Supabase auth. Every row belongs to an Organisation, and Postgres row-level security restricts access to members. There are no roles.
9. **Retention job.** Scheduled deletion of PDFs (in storage) and of packages and Check Reports 4 years after creation.

### Data shapes (decision-level, not final code)

The Extracted Figures and Confirmed Figures share one schema. Every figure is nullable: null means "not found" and leads to Not assessable, never a guess. Every figure carries a source reference `{ file, page, bbox }` for the Confirm screen.

```ts
type Figures = {
  building: {
    billingPeriod: { start: Date; end: Date } | null
    costItems: { name: string; amountCents: number | null }[]   // name verbatim
    totalCostCents: number | null
    heatingConsumptionSharePct: number | null
    hotWaterConsumptionSharePct: number | null
    allocationMethod: 'consumption_split' | 'area_only' | null
    totalAreaM2: number | null
    areaDecimals: 0 | 1 | 2 | null        // printed precision of areas
    fuel: { type: string; quantity: number | null; unit: string } | null
    co2: {
      totalKg: number | null
      statedKgPerM2Year: number | null
      statedTier: number | null           // 1–10
      statedSplit: { landlordPct: number; tenantPct: number } | null
      costCents: number | null
      statedReduction: 'none' | 'halved' | 'no_split' | null   // §9 as claimed
    }
  }
  units: {
    unitId: string
    billingPeriod: { start: Date; end: Date } | null
    areaM2: number | null
    consumption: number | null
    amountCents: number | null
    estimated: boolean | null
  }[]
}

type BuildingProfile = {
  livingAreaM2: number | null
  heatedAreaM2: number | null
  mandatory70Pct: boolean | null          // §7 para 1 sentence 2 HeizkostenV
  residential: boolean
  co2Reduction: 'none' | 'heritage' | 'district_heating' | null   // §9 CO2KostAufG
}

type CheckResult =
  | { rule: RuleId; status: 'passed' }
  | { rule: RuleId; status: 'not_assessable'; reason: string }
  | { rule: RuleId; status: 'finding'; findings: Finding[] }

type Finding = {
  severity: 'error' | 'warning'
  legalReference: string        // e.g. "§5 Abs. 1 CO2KostAufG"
  message: string               // German
  affectedUnits: string[]       // empty = whole building
  amountAtStakeCents: number | null
}
```

The Confirm screen shows the fields listed in the MVP scope plus everything the rules need from extraction: Unit Billing Periods, the estimated flag, the allocation method, the printed area precision, and all CO₂ fields. Billing Periods and the allocation method are shown compactly.

### Rule semantics

Every Finding cites its paragraph in `legalReference`.

- **C1:** |Σ Unit amounts − building total| ≤ €0.05 × number of Units. Amount at stake: the difference.
- **C2:** Σ Unit areas equals the Building Profile's **heated area** within a tolerance of (number of Units + 1) × half the smallest printed step: 0.005 m² at 2 decimals, 0.05 m² at 1 decimal, 0.5 m² for whole numbers. The heating split may use heated area while CO₂ uses living area, so one statement can correctly show two different totals; C2 compares only against heated area. Not assessable if the heated area or the printed precision is missing.
- **C3:** every Unit Statement's Billing Period equals the Building Statement's. The affected Units are the mismatching ones.
- **H1 (§7 para 1 HeizkostenV):**
  - Flag set: an Error if the share isn't exactly 70%.
  - Flag false: an Error if the share is outside 50–70%.
  - Flag unset: an Error if the share is outside 50–70%, plus a Warning that exactly 70% may be required for older oil and gas buildings (§7 para 1 sentence 2), prompting the Property Manager to complete the Building Profile.
- **H2 (§8 HeizkostenV):** 50% ≤ hot water share ≤ 70%. Not assessable if the building has no central hot water in the package (null share).
- **H3:** described under module 2 above. Amount at stake: the item amount.
- **H4 (§9a para 2 HeizkostenV):** the estimated area share is Σ area of Units with `estimated = true` divided by the total area. If it is above 25% and the allocation method is not `area_only`, raise an Error.
- **H5 (§9a para 1 HeizkostenV):** any Unit with `estimated = true` raises a Warning listing those Units.
- **K1 (CO2KostAufG):** evaluated in this order.
  1. **Time window:** Not assessable if the Billing Period starts before 1 Jan 2023 (§11 para 2), with that reason. Also Not assessable if it starts on or after 1 Jan 2028, because of the 2026 amendment (see Further Notes).
  2. **Intensity:** kg CO₂/m²/year = total CO₂ kg ÷ Building Profile living area, **rounded to one decimal before the tier lookup** (§5 para 1 sentence 3). For example, 11.96 becomes 12.0, which is tier 2.
  3. **Short Billing Periods:** if the Billing Period is shorter than 12 months, **scale the tier limits down** by the same share (§5 para 1 sentence 4). The intensity is not scaled up.
  4. **Expected split:** the tier's landlord share. If the Building Profile sets a §9 reduction, the landlord share is halved (heritage protection) or there is no split (required district heating), as the reduction case requires.
  5. **Comparison:**
     - An Error if the stated split doesn't match the expected split.
     - An Error if the stated kg/m²/year or tier doesn't match the computed one (§5 para 1).
     - A Warning if the statement claims a §9 reduction the Building Profile doesn't record. A reduction recorded in the Building Profile but not applied is covered by the split Error above.

     Amount at stake: (expected − stated landlord %) × the CO₂ cost, if the CO₂ cost is extracted; otherwise null.
  6. **Missing presentation:** if the statement doesn't show the split, the tier or how they were worked out, raise a Warning. It says the Tenant may cut their heating costs by 3% (§7 para 3–4). Amount at stake: 3% of the Unit amounts.
- **K2:** if both total CO₂ and the stated split are null, the result is `finding` with a Warning that carries the same §7 para 3–4 message about the 3% cut. K1 then returns Not assessable.
- **B1 (§556 para 3 BGB):**
  - **Deadline:** Billing Period end + 12 **calendar months**, per §188 para 2 BGB, never 365 days. If the target month is shorter, the deadline is its last day (§188 para 3); a period ending 28 Feb 2025, for example, has a deadline of 28 Feb 2026.
  - **Error:** if the Dispatch Date is after the deadline.
  - **Warning:** if the Dispatch Date falls within 4 weeks (28 days, §188 para 2 BGB) before the deadline.
- Findings are ordered with Errors before Warnings, then in catalogue order.

### Supersession

Uploading a package for a building and Billing Period that already has one marks the older package `superseded_by` the new one. Nothing is deleted. Views default to the current package and link to its history.

## Testing Decisions

- **What makes a good test:** it exercises behaviour only through the two seams and asserts on observable output (Check Results, Findings, Extracted Figures). It never reaches into rule internals, prompt text or database layout. Tests are written test-first (red-green-refactor).
- **Seam 1: check engine (`checkPackage`).** This is the main test surface.
  - Per rule: Passed, Finding raised and Not assessable cases, including boundaries:
    - C1 at exactly ±€0.05 × n.
    - C2 at each printed precision (0, 1 and 2 decimals), including whole-number areas that would fail a fixed ±0.01 m² tolerance.
    - H1 and H2 at 50% and 70%, and H1 with the flag set, false and unset.
    - H4 at exactly 25%.
    - B1 at exactly 28 days, on the deadline day, and with a period ending at the end of February and on the 31st of a month.
  - K1 cases:
    - Each tier edge (lower limit included, upper excluded).
    - Rounding across a tier edge (11.96 → 12.0 → tier 2; 11.94 → 11.9 → tier 1).
    - A short Billing Period with scaled-down limits.
    - A period starting 31 Dec 2022 (Not assessable) and 1 Jan 2023 (assessed).
    - A period starting 1 Jan 2028 (Not assessable).
    - Heritage protection (landlord share halved) and required district heating (no split).
    - A §9 reduction the statement claims but the Building Profile doesn't record.
    - A stated tier that is wrong while the stated split is right.
    - Missing split or tier, giving the 3% Warning.
    - A test that the tenant and landlord shares aren't swapped.
  - A "clean package" fixture where all 11 rules pass.
  - **Planted-error fixtures:** a copy of a clean package for each rule, with one planted error, asserting that only that rule raises a Finding. This mirrors the success criterion "all deliberately planted errors are caught".
  - Invariants: exactly one Check Result per rule; deterministic output for the same input; the Ruleset version is stamped; every Finding has a legal reference.
  - Mapping-table tests for H3: known Minol names map, unknown names give a Warning, and ineligible names give an Error.
- **Seam 2: Extractor.**
  - An eval suite runs the Bedrock adapter against 5–10 real, anonymised Minol Statement Packages, with hand-labelled expected figures, including the CO₂ fields and the printed area precision. It reports the share of correct figures, with a target of ≥ 95%. It runs on demand, not in CI, because it needs real PDFs and AWS credentials.
  - A Zod contract test checks that malformed model output is rejected as a failed extraction.
  - All flow and UI work downstream uses the fake Extractor.
- **Seam 3: database access boundary (agreed 2026-09-30, ticket 01).** Tests apply the real migrations to an in-process Postgres (PGlite) on top of a shim of Supabase's auth schema and default grants. They then act as signed-in users (`auth.uid()`) and assert what each can read or write: isolation between Organisations, equal rights within one, and that every `public` table has row-level security. Each new Organisation-owned table gets an isolation test here.
- **Not tested at a seam:** the Confirm UI, PDF rendering and the rest of persistence are covered by a manual end-to-end run on one real package (target: under 10 minutes for a Property Manager).
- **Prior art:** none yet. The repo has no code, so these tests set the pattern.

## Out of Scope

- A complaint (Reklamation) to the Metering Provider generated from the Findings.
- WEG / condominium management and Sign-off (ADR 0002).
- Plausibility checks against the previous year or similar Units.
- Other formal requirements (e.g. §6a HeizkostenV monthly consumption information), GEG, and §556 BGB beyond the 12-month deadline.
- Mixed-use and non-residential buildings (and so the §8 CO2KostAufG 50/50 split), buildings with fewer than 3 Units, and non-central heating.
- The 2026 CO2KostAufG amendment's 50/50 split for Billing Periods from 1 Jan 2028 (K1 returns Not assessable for those; see Further Notes).
- Metering Providers other than Minol (ista, Techem, Brunata). Extraction is provider-agnostic in principle but tested on Minol only.
- Roles within an Organisation.
- An explanation document for Tenants.
- Any AI judgement of figures (ADR 0001).

## Further Notes

- **Legal basis checked by the maintainer (2026-09-29)** against the current texts of CO2KostAufG (as amended 23.7.2026) and its annex, §7 and §9a HeizkostenV, and §188 BGB:
  - The CO₂ tier table, the one-decimal rounding, the short-period scaling and the 2023 start date are confirmed.
  - The C2 tolerance formula and the 28-day and calendar-month rules for B1 are confirmed.
  - The maintainer isn't a lawyer, so someone qualified must review the Ruleset before real use. That fits with the RDG legal opinion on the later list.
- **CO2KostAufG 2026 amendment:**
  - **Dates:** the maintainer's notes give 29 July 2026 as the date of the change, while the sources list "as amended 23.7.2026". Pin down which is the promulgation date and which the date it took effect.
  - **Content:** from 1 Jan 2028, CO₂ costs for some gas, oil and LPG heating systems (those covered by §43 para 1 of the new building law) are split 50/50 instead of by the table, with hardship exceptions (§§5a, 5d).
  - **What's needed:** K1 must handle this before any 2028 Billing Period. That needs a Building Profile flag for whether §43 para 1 applies, because the building-law assessment itself is outside the Ruleset.
  - **Status:** the official site says it hasn't fully processed this change yet, so check again before implementing.
- **Before handling real packages:** set Bedrock data retention to `none` in `eu-west-1`, confirm `allowed_modes` includes `none`, sign the AWS GDPR DPA, and name AWS `eu-west-1` in the AV-Vertrag.
- **RDG legal opinion:** it is on the later list, but it's needed before launch, not before building.
