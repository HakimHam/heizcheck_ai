# 10: Rule B1 (§556 para 3 BGB deadline)

**What to build:** The Check Report catches Statement Packages that are sent after the §556 para 3 BGB deadline, and warns when the deadline is close. See the spec: Rule semantics for B1.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [ ] The deadline is the Billing Period end + 12 calendar months (§188 para 2 BGB), never 365 days.
- [ ] If the target month is shorter, the deadline is its last day (§188 para 3 BGB).
- [ ] An Error when the Dispatch Date is after the deadline.
- [ ] A Warning when the Dispatch Date is within 28 days before the deadline.
- [ ] Tests cover:
  - a Dispatch Date exactly 28 days before the deadline
  - a Dispatch Date on the deadline day
  - a Dispatch Date on the day after the deadline
  - a period ending on 28 Feb
  - a period ending on the 31st of a month
  - a leap year
- [ ] The rule uses only the Dispatch Date passed in, never the system clock.
- [ ] A planted-error fixture in which only B1 raises a Finding.
