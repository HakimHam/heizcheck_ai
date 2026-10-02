# 08: Rules K1 + K2 core (CO₂ tier)

**What to build:** The Check Report catches CO₂ cost splits between landlord and Tenant that don't match the CO2KostAufG tier. It also warns when a statement has no CO₂ data. This ticket covers the core calculation. §9 reductions and checking the figures the statement itself gives are ticket 09.

See the spec:
- module 3 (the tier table)
- Rule semantics for K1: steps 1–3, the split comparison in step 5, and step 6
- Rule semantics for K2

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

**Tier table**

- [x] The tier table from the CO2KostAufG annex is a Ruleset constant, with the tenant and landlord shares stored as named fields.
- [x] Each tier includes its lower limit and excludes its upper one.

**Calculation**

- [x] K1 is Not assessable, with the reason, for Billing Periods starting before 1 Jan 2023 (§11 para 2) or on or after 1 Jan 2028 (the 2026 amendment).
- [x] kg CO₂/m²/year = total CO₂ kg ÷ the Building Profile's living area, rounded to one decimal before the tier lookup (§5 para 1 sentence 3).
- [x] For Billing Periods shorter than 12 months, the tier limits are scaled down by the same share (§5 para 1 sentence 4). The kg/m²/year value is not scaled up.

**Findings**

- [x] An Error when the stated landlord/tenant split doesn't match the tier. The amount at stake is (expected − stated landlord %) × the CO₂ cost when the CO₂ cost is extracted, otherwise null.
- [x] A Warning when the statement doesn't show the split, the tier or how they were worked out. It says the Tenant may cut their heating costs by 3% (§7 para 3–4).
- [x] K2: a Warning with the same 3% message when both total CO₂ and the stated split are missing. K1 is then Not assessable.

**Tests and screen**

- [x] Tests cover:
  - every tier edge
  - rounding across an edge: 11.96 gives tier 2, 11.94 gives tier 1
  - a short Billing Period
  - periods starting on 31 Dec 2022, 1 Jan 2023 and 1 Jan 2028
  - tenant and landlord shares not swapped
- [x] All CO₂ fields are shown on the Confirm screen.
- [x] K1 and K2 each have a planted-error fixture.

## Comments

**2026-10-02 (implementation, branch `feature/ticket-claude_code_impl`):**

- `rules/co2.ts` holds the tier table (`CO2_TIERS`, named `tenantPct`/`landlordPct` fields, `fromKg` included, `belowKg` excluded), the time window, the intensity and the 3% Warning shared by K1 and K2. `co2.test.ts` fingerprints the table per Ruleset version, like the cost type tables.
- **Intensity:** total CO₂ kg ÷ the Building Profile's living area, rounded half up to one decimal in exact integer arithmetic (thousandths of a kg and a m²), so 11.95 becomes 12.0.
- **Short Billing Periods:** the tier limits are scaled by the period's days (inclusive) ÷ the days to the same date 12 months later. Comparisons stay in integers. A period of 12 months or longer is not scaled.
- **Time window:** K1 and K2 are Not assessable for Billing Periods starting before 01.01.2023 or on or after 01.01.2028, and when the Building Statement's Billing Period is missing.
- **Split Error** (`§5 Abs. 1 CO2KostAufG`): both shares must match the tier within 0.005 points, so a swapped split is caught. The amount at stake is |expected − stated Property Manager %| × the CO₂ cost, kept positive like C1. The message says which side carries too much. It is null without the CO₂ cost.
- **3% Warning** (`§7 Abs. 3, 4 CO2KostAufG`): raised when the statement doesn't show the split, the tier, the total CO₂ or the kg/m²/year ("how they were worked out"). Amount at stake: 3% of the Unit amounts, null if one is missing. It comes after the split Error.
- **K2:** a Warning with the same message when both the total CO₂ and the split are missing. K1 is then Not assessable and points to K2.
- **Until 09:** when the Building Profile records `heritage` or `district_heating`, K1 is Not assessable instead of raising a split Error. The 3% Warning still applies. The stated reduction, kg/m²/year and tier are not compared yet.
- **Planted errors:** K1 has the clean package split 30/70 in tier 5. K2 has no CO₂ data at all.
- The Confirm screen already showed all six CO₂ fields (`confirm-form.tsx`), so no UI changed.
- `toUtc` and `daysBetween` moved from `b1.ts` to `src/lib/dates.ts`. `Co2Split` is now a named type in `figures.ts`.
- Ruleset version 0.8.0. The cost type tables are unchanged.
