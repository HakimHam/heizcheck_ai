# 05: Rules H1 + H2 (consumption shares)

**What to build:** The Check Report catches heating and hot water consumption shares that break §7 and §8 HeizkostenV, taking the Building Profile's 70% flag into account. See the spec: Rule semantics for H1 and H2.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [ ] H1 when the 70% flag is set: an Error unless the heating consumption share is exactly 70%.
- [ ] H1 when the flag is false: an Error if the share is outside 50–70%.
- [ ] H1 when the flag is unset: an Error if the share is outside 50–70%. It also adds a Warning that exactly 70% may be required for older oil and gas buildings (§7 para 1 sentence 2), prompting the Property Manager to complete the Building Profile.
- [ ] H2: an Error if the hot water consumption share is outside 50–70%. H2 is Not assessable when the package has no hot water share.
- [ ] Boundary tests at exactly 50% and 70% for both rules.
- [ ] Each rule has a planted-error fixture in which only that rule raises a Finding.
- [ ] H1 Findings cite §7 para 1 HeizkostenV, and H2 Findings cite §8 HeizkostenV.
