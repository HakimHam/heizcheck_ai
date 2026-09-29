# 08: Rules K1 + K2 core (CO₂ tier)

**What to build:** The Check Report catches CO₂ cost splits between landlord and Tenant that don't match the CO2KostAufG tier. It also warns when a statement has no CO₂ data. This ticket covers the core calculation. §9 reductions and checking the figures the statement itself gives are ticket 09.

See the spec:
- module 3 (the tier table)
- Rule semantics for K1: steps 1–3, the split comparison in step 5, and step 6
- Rule semantics for K2

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

**Tier table**

- [ ] The tier table from the CO2KostAufG annex is a Ruleset constant, with the tenant and landlord shares stored as named fields.
- [ ] Each tier includes its lower limit and excludes its upper one.

**Calculation**

- [ ] K1 is Not assessable, with the reason, for Billing Periods starting before 1 Jan 2023 (§11 para 2) or on or after 1 Jan 2028 (the 2026 amendment).
- [ ] kg CO₂/m²/year = total CO₂ kg ÷ the Building Profile's living area, rounded to one decimal before the tier lookup (§5 para 1 sentence 3).
- [ ] For Billing Periods shorter than 12 months, the tier limits are scaled down by the same share (§5 para 1 sentence 4). The kg/m²/year value is not scaled up.

**Findings**

- [ ] An Error when the stated landlord/tenant split doesn't match the tier. The amount at stake is (expected − stated landlord %) × the CO₂ cost when the CO₂ cost is extracted, otherwise null.
- [ ] A Warning when the statement doesn't show the split, the tier or how they were worked out. It says the Tenant may cut their heating costs by 3% (§7 para 3–4).
- [ ] K2: a Warning with the same 3% message when both total CO₂ and the stated split are missing. K1 is then Not assessable.

**Tests and screen**

- [ ] Tests cover:
  - every tier edge
  - rounding across an edge: 11.96 gives tier 2, 11.94 gives tier 1
  - a short Billing Period
  - periods starting on 31 Dec 2022, 1 Jan 2023 and 1 Jan 2028
  - tenant and landlord shares not swapped
- [ ] All CO₂ fields are shown on the Confirm screen.
- [ ] K1 and K2 each have a planted-error fixture.
