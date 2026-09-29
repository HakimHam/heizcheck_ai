# 07: Rules H4 + H5 (estimated readings)

**What to build:** The Check Report catches statements that still split costs by consumption when readings were estimated for too much of the area (§9a para 2 HeizkostenV). It also warns whenever any readings were estimated (§9a para 1). See the spec: Rule semantics for H4 and H5.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [ ] H4 computes the estimated area share as the total area of Units with estimated readings ÷ the total area.
- [ ] H4 raises an Error when that share is above 25% and the allocation method is not area-only.
- [ ] A boundary test with a share of exactly 25%, which passes H4.
- [ ] H5 raises a Warning listing every Unit with estimated readings.
- [ ] Both rules are Not assessable when the estimated flag or the allocation method is missing.
- [ ] The estimated flag and the allocation method are shown on the Confirm screen.
- [ ] Each rule has a planted-error fixture in which only that rule raises a Finding.
