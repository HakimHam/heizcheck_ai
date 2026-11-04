# 05: Rules H1 + H2 (consumption shares)

**What to build:** The Check Report catches heating and hot water consumption shares that break §7 and §8 HeizkostenV, taking the Building Profile's 70% flag into account. See the spec: Rule semantics for H1 and H2.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [x] H1 when the 70% flag is set: an Error unless the heating consumption share is exactly 70%.
- [x] H1 when the flag is false: an Error if the share is outside 50–70%.
- [x] H1 when the flag is unset: an Error if the share is outside 50–70%. It also adds a Warning that exactly 70% may be required for older oil and gas buildings (§7 para 1 sentence 2), prompting the Property Manager to complete the Building Profile.
- [x] H2: an Error if the hot water consumption share is outside 50–70%. H2 is Not assessable when the package has no hot water share.
- [x] Boundary tests at exactly 50% and 70% for both rules.
- [x] Each rule has a planted-error fixture in which only that rule raises a Finding.
- [x] H1 Findings cite §7 para 1 HeizkostenV, and H2 Findings cite §8 HeizkostenV.

## Comments

**2026-10-02 (implementation, branch `feature/ticket-claude_code_impl`):**

- H1 (`rules/h1.ts`) and H2 (`rules/h2.ts`) share `rules/consumption-share.ts`, which holds the 50–70% range and the out-of-range Error. Findings name the whole building (`affectedUnits: []`) and have no amount at stake.
- **Deviation from the literal spec:** when the 70% flag is unset and the share is exactly 70%, H1 passes without the Warning. 70% is lawful whichever way the flag is set, so there is nothing to warn about. The Building Profile page still lists the flag as unknown. If the Warning should also prompt completing the profile in this case, remove the `share !== MANDATORY_SHARE_PCT` guard in the `null` branch.
- H1 is Not assessable when the heating share is missing. The spec defines Not assessable only for H2.
- **Legal references to confirm in the legal review:** the 50–70% Error cites `§7 Abs. 1 HeizkostenV`. The exactly-70% Error and the flag-unset Warning cite `§7 Abs. 1 Satz 2 HeizkostenV`. H2 cites `§8 Abs. 1 HeizkostenV`. The Warning spells out all three conditions of Satz 2: WSchV 1994 not met, oil or gas heating, pipes mostly insulated.
- The H1 planted error is 60% with the flag set, so it is caught only by the exactly-70% branch.
- Ruleset version 0.3.0.
