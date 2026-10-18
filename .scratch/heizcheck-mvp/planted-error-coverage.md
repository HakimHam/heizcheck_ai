# Planted-error coverage (rule-coverage-scout, 2026-10-17)

Verbatim reply from `rule-coverage-scout`. See `docs/agents/context-workflow.md`, step 3.

RULE_IDS has 11 entries: C1, C2, C3, H1, H2, H3, H4, H5, K1, K2, B1. Issue 16 line 5 says "11 rules", so it matches. check-package.test.ts line 29 also asserts length 11.

All 11 rules have a plantedErrors entry in fixtures.ts. Each "minimal mutation" below is the existing fixture's mutation of cleanPackage, not a new one.

| RuleId | rule file | planted? | trigger + legal basis | fields read | minimal mutation (existing) | may also raise | boundary tests? |
|---|---|---|---|---|---|---|---|
| C1 | rules/c1.ts | yes | Unit amounts sum differs from building total by more than 5 cents per Unit. §6 Abs. 1 HeizkostenV | building.totalCostCents; units[].amountCents | WE 02 amountCents 120000 to 120100 | none | yes (exactly 5 cents per Unit passes, 1 cent beyond fails) |
| C2 | c2.ts | yes | Unit area sum differs from heated area by more than (Units+1) x half the printed step. §7 Abs. 1 HeizkostenV | building.areaDecimals; units[].areaM2; profile.heatedAreaM2 | WE 03 areaM2 70.5 to 75.5 | none | yes (at and above, for 0, 1 and 2 decimals) |
| C3 | c3.ts | yes | A Unit's Billing Period differs from the building's. §556 Abs. 3 BGB | building.billingPeriod; units[].billingPeriod | WE 01 period set to 2024 | none | no threshold (equality check) |
| H1 | h1.ts | yes | Heating share is outside 50-70%, or is not exactly 70% when mandatory70Pct is true (Error). With the flag unset, a share other than 70% gets a Warning. §7 Abs. 1 and Abs. 1 Satz 2 HeizkostenV | building.heatingConsumptionSharePct; profile.mandatory70Pct | heatingConsumptionSharePct 70 to 60 | none | yes |
| H2 | h2.ts | yes | Hot water share is outside 50-70%. §8 Abs. 1 HeizkostenV | building.hotWaterConsumptionSharePct | hotWaterConsumptionSharePct 70 to 45 | none | yes |
| H3 | h3.ts | yes | A Cost Item maps to not-eligible (Error) or is not in the mapping table (Warning). §7 Abs. 2 HeizkostenV | building.costItems | Split the cost items into Brennstoffkosten 258750 and Reparaturkosten 41250 | none | not applicable (mapping lookup, no numeric threshold) |
| H4 | h4.ts | yes | Estimated Units hold more than 25% of the area while allocationMethod is consumption_split. §9a Abs. 2 HeizkostenV | building.allocationMethod; units[].estimated, areaM2 | WE 01 and WE 02 estimated true (two thirds of the area) | H5 (documented in alsoRaised) | yes (exactly 25% passes, just above fails) |
| H5 | h5.ts | yes | Any Unit has estimated readings (Warning). §9a Abs. 1 HeizkostenV | units[].estimated | WE 01 estimated true and areaM2 40.5, WE 02 areaM2 100.5 (19% so H4 passes) | none | not applicable (any estimated Unit warns) |
| K1 | k1.ts | yes | Stated CO2 split differs from the tier's split (adjusted for the §9 reductions), or the stated kg/m2 or tier is wrong (Errors). Missing items give a 3% cut Warning. §5 Abs. 1 and §9 CO2KostAufG | building.co2.*; building.billingPeriod; profile.livingAreaM2, co2Reduction; units | co2.statedSplit 40/60 to 30/70 | none | yes (each tier limit and limit minus 0.1, window start 2023-01-01 and 2028-01-01) |
| K2 | k2.ts | yes | Both co2.totalKg and co2.statedSplit are null (3% cut Warning). CO2KostAufG via threePercentCutWarning in co2.ts | building.co2.totalKg, statedSplit; billingPeriod; units | All co2 fields null except costCents | none (K1 returns not_assessable) | partly (the time window is tested; the legal reference is not read) |
| B1 | b1.ts | yes | Dispatch is past the deadline, which is period end plus 12 months (Error). Fewer than 28 days left gives a Warning. §556 Abs. 3 BGB; the 4-week window uses §188 BGB | building.billingPeriod; dispatchDate | dispatchDate 2026-03-15 to 2027-01-04 | none | partly (29 days left passes, deadline day warns, day after errors; 28 days left, the Warning boundary, is not tested) |

**cleanPackage:** it passes every rule. check-package.test.ts line 40 expects no result with a status other than 'passed'. planted-errors.test.ts also asserts that no rule raises a Finding.

**Gaps:** none. Every RuleId has a planted fixture, and alsoRaised documents the only overlap (H4 raises H5). planted-errors.test.ts asserts that each fixture raises exactly its own rule plus any alsoRaised rules.

**Unsure:**
- I did not run the tests, so the claim that every fixture is isolated rests on the assertions in planted-errors.test.ts.
- B1 28-day Warning boundary: the code is at b1.ts line 6 (WARNING_DAYS = 28), but check-package.test.ts lines 596-660 have no case for exactly 28 or 27 days left.
- K2's exact legal reference comes from threePercentCutWarning in rules/co2.ts, which I did not read.
- I did not check whether the K1 tier-limit tests (check-package.test.ts around lines 715-730) cover "just above" for every tier.
