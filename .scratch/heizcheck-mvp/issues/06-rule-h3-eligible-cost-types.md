# 06: Rule H3 (Eligible Cost Types + Minol mapping)

**What to build:** The Check Report catches Cost Items that Tenants can't be charged for. It uses two lists, both versioned with the Ruleset:

- a fixed list of Eligible Cost Types, derived from §7 para 2 HeizkostenV
- a mapping table from Minol's Cost Item names to that list

The AI extracts Cost Item names exactly as written, and H3 does the lookup. See the spec: module 2.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [ ] The list of Eligible Cost Types covers every category in §7 para 2 HeizkostenV.
- [ ] The mapping table maps each known Minol Cost Item name either to an Eligible Cost Type or to "not eligible".
- [ ] The lookup ignores differences in whitespace and case, and nothing else.
- [ ] A Cost Item mapped to "not eligible" raises an Error, with its amount as the amount at stake.
- [ ] A Cost Item that isn't in the table raises a Warning naming the item exactly as written.
- [ ] Tests cover known, ineligible and unknown names.
- [ ] A planted-error fixture in which only H3 raises a Finding.
- [ ] Changing either the list or the mapping table bumps the Ruleset version.
