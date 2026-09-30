-- The Building Profile: facts the Metering Provider doesn't supply but the
-- Ruleset needs. It lives on the building row, one profile per building,
-- reused across Billing Periods. Check Reports copy it into their snapshot.
--
-- Unknown is null, never a default, so rules can report Not assessable
-- instead of checking against a guess. Only `residential` is always known:
-- it decides whether the building is in scope at all.

alter table public.buildings
  add column living_area_m2 numeric(10, 2) check (living_area_m2 > 0),
  add column heated_area_m2 numeric(10, 2) check (heated_area_m2 > 0),
  -- §7 Abs. 1 Satz 2 HeizkostenV: exactly 70% consumption share is mandatory.
  add column mandatory_70_pct boolean,
  add column residential boolean,
  -- §9 CO2KostAufG: heritage protection halves the landlord share,
  -- required district heating removes the split.
  add column co2_reduction text check (co2_reduction in ('none', 'heritage', 'district_heating'));

-- Buildings created before this migration are taken as residential; the
-- Property Manager can correct that in the Building Profile.
update public.buildings set residential = true;

alter table public.buildings alter column residential set not null;
