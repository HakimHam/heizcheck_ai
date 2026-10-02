# 07: Rules H4 + H5 (estimated readings)

**What to build:** The Check Report catches statements that still split costs by consumption when readings were estimated for too much of the area (§9a para 2 HeizkostenV). It also warns whenever any readings were estimated (§9a para 1). See the spec: Rule semantics for H4 and H5.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [x] H4 computes the estimated area share as the total area of Units with estimated readings ÷ the total area.
- [x] H4 raises an Error when that share is above 25% and the allocation method is not area-only.
- [x] A boundary test with a share of exactly 25%, which passes H4.
- [x] H5 raises a Warning listing every Unit with estimated readings.
- [x] Both rules are Not assessable when the estimated flag or the allocation method is missing.
- [x] The estimated flag and the allocation method are shown on the Confirm screen.
- [x] Each rule has a planted-error fixture in which only that rule raises a Finding.

## Comments

**2026-10-02 (implementation, branch `feature/ticket-claude_code_impl`):**

- `rules/h4.ts` and `rules/h5.ts` share `rules/estimated-readings.ts`. C2 and H4 now share the area arithmetic in `rules/areas.ts`. Areas are summed in whole thousandths of a m², so the 25% limit is compared exactly: 25.00% passes and 25.04% is an Error.
- **Denominator:** "the total area" is taken to be the sum of the Unit areas, so numerator and denominator come from the same figures. C2 already checks that sum against the Building Profile's heated area. H4 is Not assessable when a Unit area is missing.
- **Not assessable:**
  - Following this ticket literally, both rules are Not assessable when any Unit's estimated flag is missing or the allocation method is missing. Both also are when there are no Unit Statements.
  - Two consequences, for the user to decide on:
    - H5 doesn't need the allocation method, but it still loses its Warning without it.
    - H4 also returns Not assessable when the flags that are known already put more than 25% of the area under estimate.
- **Findings:** H4 is an Error citing `§9a Abs. 2 HeizkostenV` and H5 a Warning citing `§9a Abs. 1 HeizkostenV`. Both list the Units with estimated readings in `affectedUnits`, and neither has an amount at stake (the spec gives none).
- **Planted errors:** an H4 error needs estimated readings, which H5 always warns about, so no fixture can raise H4 alone. `alsoRaised = { H4: ['H5'] }` in `fixtures.ts` records this exception, and the test expects exactly `[H4, H5]`. The H5 fixture resizes WE 01 to 40.5 m² (19%), so H4 passes and C2 still adds up.
- **Confirm screen:** it already shows the allocation method ("Verteilung") and a "geschätzt" column per Unit (`confirm-form.tsx`), so nothing changed there.
- Ruleset version 0.5.0. The cost type tables are unchanged, so the fingerprint is the same.
