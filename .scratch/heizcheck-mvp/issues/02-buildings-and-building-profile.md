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

- [x] A Property Manager can create a building with an address and see it in the buildings list.
- [x] The Building Profile can be edited:
  - living area
  - heated area
  - the 70% flag (set / false / unset)
  - residential (yes / no)
  - CO₂ reduction (none / heritage protection / district heating / unset)
- [x] Unset values are stored as unknown, not filled with a default, so the rules can report Not assessable.
- [x] A building marked non-residential is clearly shown as out of scope. The upload refusal for such buildings is enforced in 03, once upload exists.
- [x] The buildings list shows each building's Billing Periods and latest Check Report status. These stay empty until 03 lands.
- [x] All screens are in German.
- [x] Only members of the Organisation that owns a building can see it.

## Comments

**2026-10-01 (implementation, branch `feature/ticket-claude_code_impl`):**

- Migration `20261001223731_buildings.sql` puts the Building Profile on the `buildings` row. Unknown facts are `null`. `residential` is required in the form and never defaulted. RLS and the stored-as-unknown behaviour are proven by `supabase/tests/building-access.test.ts`.
- Form parsing (German decimals, three-state choices, German error messages) lives in `src/lib/building-form.ts`, tested at that seam.
- Buildings can't be deleted from the app (delete is revoked). Statement Packages and Check Reports will hang off them and are kept for 4 years. Revisit if deleting an empty building is wanted.
- Only "non-residential" is recorded for scope. Story 17's other conditions (no central heating, fewer than 3 Units) aren't captured anywhere yet; ticket 03 will need to decide where they come from.
- **Open:** spec K1.4 maps heritage protection to "halved" and required district heating to "no split". The review questioned whether §9 CO2KostAufG really splits along those lines (as recalled: halved when one improvement is blocked, no split when both are). Check this against the statute before ticket 08.
- 2026-10-02: migration applied to HeizCheck_AI (eu-central-1). Local migration files renamed to the versions Supabase recorded.
