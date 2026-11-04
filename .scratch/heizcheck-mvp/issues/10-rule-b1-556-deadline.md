# 10: Rule B1 (§556 para 3 BGB deadline)

**What to build:** The Check Report catches Statement Packages that are sent after the §556 para 3 BGB deadline, and warns when the deadline is close. See the spec: Rule semantics for B1.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [x] The deadline is the Billing Period end + 12 calendar months (§188 para 2 BGB), never 365 days.
- [x] If the target month is shorter, the deadline is its last day (§188 para 3 BGB).
- [x] An Error when the Dispatch Date is after the deadline.
- [x] A Warning when the Dispatch Date is within 28 days before the deadline.
- [x] Tests cover:
  - a Dispatch Date exactly 28 days before the deadline
  - a Dispatch Date on the deadline day
  - a Dispatch Date on the day after the deadline
  - a period ending on 28 Feb
  - a period ending on the 31st of a month
  - a leap year
- [x] The rule uses only the Dispatch Date passed in, never the system clock.
- [x] A planted-error fixture in which only B1 raises a Finding.

## Comments

**2026-10-02 (implementation, branch `feature/ticket-claude_code_impl`):**

- `rules/b1.ts`. The deadline is the Building Statement's Billing Period end with the year advanced by one. The day is kept, or capped at the last day of the target month, so a period ending 29.02.2024 is due on 28.02.2025. A period ending 28.02.2023 is due on 28.02.2024, not on 29.02.
- **Warning window:** a Warning when the Dispatch Date is 0 to 28 days before the deadline, inclusive at both ends (the deadline day itself and exactly 28 days before). It passes at 29 days and is an Error from the day after the deadline. Days are counted on UTC dates, so daylight saving time cannot shift them.
- **Leap year:** a period ending 31.03.2027 is due on 31.03.2028. 365 days later would be 30.03.2028.
- **Not assessable** when the Building Statement's Billing Period is missing. The Units' periods aren't used, since C3 already checks that they match.
- **Findings** cite `§556 Abs. 3 BGB` and cover the whole building (`affectedUnits: []`). Neither has an amount at stake, because the spec gives none and the Tenant balances aren't extracted. The Error message gives the deadline, the Dispatch Date and how many days late it is. The Warning gives the days left.
- **Planted error:** the clean package sent on 04.01.2027, four days late. Only B1 raises a Finding.
- The upload form already collects the Dispatch Date (defaulting to today), so no UI changed.
- Ruleset version 0.7.0. The cost type tables are unchanged, so the fingerprint is the same.
