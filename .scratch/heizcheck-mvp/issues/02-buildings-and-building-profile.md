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

**2026-09-30 (agent):** Implemented on `feature/specs-implementation`.

- The Building Profile is stored as columns on `buildings`, one per building. Unknown values are `null`: blank areas, "Unbekannt" for the 70% flag and for the §9 reduction. `residential` is always yes/no. The create form asks for it without a preselected answer, and the database requires it.
- Screens: `/` lists the buildings. It has "Außerhalb des Prüfumfangs" and "Gebäudeprofil unvollständig" badges and placeholder columns for Billing Periods and the latest Check Report, which stay empty until 03. `/gebaeude/neu` creates a building. `/gebaeude/[id]` edits the address and the Building Profile and shows the out-of-scope notice. Another Organisation's building shows the German 404 page.
- Areas accept German notation ("1.234,56") or a decimal point, with at most 2 decimals, matching `numeric(10,2)`.
- Tests: `supabase/tests/building-profile.test.ts` (seam 3) covers unknown stays null, reset to unknown, constraints and isolation between Organisations. `src/lib/buildings/building-form.test.ts` covers form parsing and round-tripping.
- Not done: deleting buildings. Module 7 says CRUD, but this ticket doesn't ask for it, and deletion needs a decision on what happens to Check Reports (append-only).
