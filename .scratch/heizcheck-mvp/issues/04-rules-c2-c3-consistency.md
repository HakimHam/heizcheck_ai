# 04: Rules C2 + C3 (consistency)

**What to build:** The Check Report catches two consistency problems: Unit areas that don't add up to the building's heated area, and statements in one Statement Package that don't share the same Billing Period. See the spec: Rule semantics for C2 and C3.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [ ] C2 compares the sum of the Unit areas with the Building Profile's heated area (not the living area).
- [ ] The C2 tolerance is (number of Units + 1) × half the smallest printed step, using the extracted printed precision:
  - 0.005 m² when areas are printed with 2 decimals
  - 0.05 m² with 1 decimal
  - 0.5 m² for whole numbers
- [ ] C2 is Not assessable, with the reason, when the heated area or the printed precision is missing.
- [ ] C2 tests cover each printed precision, including whole-number areas that a fixed ±0.01 m² tolerance would wrongly fail.
- [ ] C3 raises an Error when any Unit Statement's Billing Period differs from the Building Statement's, listing the Units that don't match.
- [ ] Each rule has a planted-error fixture in which only that rule raises a Finding.
- [ ] The printed area precision is shown on the Confirm screen.
