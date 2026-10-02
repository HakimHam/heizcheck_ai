# 04: Rules C2 + C3 (consistency)

**What to build:** The Check Report catches two consistency problems: Unit areas that don't add up to the building's heated area, and statements in one Statement Package that don't share the same Billing Period. See the spec: Rule semantics for C2 and C3.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [x] C2 compares the sum of the Unit areas with the Building Profile's heated area (not the living area).
- [x] The C2 tolerance is (number of Units + 1) × half the smallest printed step, using the extracted printed precision:
  - 0.005 m² when areas are printed with 2 decimals
  - 0.05 m² with 1 decimal
  - 0.5 m² for whole numbers
- [x] C2 is Not assessable, with the reason, when the heated area or the printed precision is missing.
- [x] C2 tests cover each printed precision, including whole-number areas that a fixed ±0.01 m² tolerance would wrongly fail.
- [x] C3 raises an Error when any Unit Statement's Billing Period differs from the Building Statement's, listing the Units that don't match.
- [x] Each rule has a planted-error fixture in which only that rule raises a Finding.
- [x] The printed area precision is shown on the Confirm screen.

## Comments

**2026-10-02 (implementation, branch `feature/ticket-claude_code_impl`):**

- C2 (`rules/c2.ts`) compares areas in whole thousandths of a m², so no floats are compared. Its Finding names the whole building (`affectedUnits: []`) and has no amount at stake. It is Not assessable without the heated area, without the printed precision, when any Unit area is missing, or when the package has no Unit Statements.
- C3 (`rules/c3.ts`) lists only the mismatching Units. If one Unit differs and another Unit's period is missing, it still raises the Error. It is Not assessable only when nothing differs but a period is missing.
- **Legal references to confirm in the legal review:** C2 cites `§7 Abs. 1 HeizkostenV` (area-based basic costs). C3 cites `§556 Abs. 3 BGB` (the Billing Period). The spec didn't name either.
- Planted-error fixtures live in `check-engine/fixtures.ts` (`cleanPackage`, `plantedErrors`) and are asserted in `planted-errors.test.ts`. Later rules add an entry there. For now the clean package is asserted to raise no Finding; once all 11 rules are built, tighten that to "all Passed".
- The Confirm screen already showed the printed area precision ("Flächen gedruckt mit") from ticket 03.
- Ruleset version 0.2.0.
