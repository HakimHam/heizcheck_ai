# 02: Buildings and Building Profile

**What to build:** A Property Manager can create a building and fill in its Building Profile once, for reuse across Billing Periods. The Building Profile holds the true facts that the Metering Provider doesn't supply:

- living area
- heated area
- whether §7 para 1 sentence 2 HeizkostenV (mandatory 70% consumption share) applies
- whether the building is residential
- whether it is heritage-protected or must use district heating (§9 CO2KostAufG)

Buildings outside scope are marked as such. See the spec: module 7 and the `BuildingProfile` shape.

**Blocked by:** 01 (Walking skeleton).

**Status:** ready-for-agent

- [ ] A Property Manager can create a building with an address and see it in the buildings list.
- [ ] The Building Profile can be edited:
  - living area
  - heated area
  - the 70% flag (set / false / unset)
  - residential (yes / no)
  - CO₂ reduction (none / heritage protection / district heating / unset)
- [ ] Unset values are stored as unknown, not filled with a default, so the rules can report Not assessable.
- [ ] A building marked non-residential is clearly shown as out of scope. The upload refusal for such buildings is enforced in 03, once upload exists.
- [ ] The buildings list shows each building's Billing Periods and latest Check Report status. These stay empty until 03 lands.
- [ ] All screens are in German.
- [ ] Only members of the Organisation that owns a building can see it.
