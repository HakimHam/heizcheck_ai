# 06: Rule H3 (Eligible Cost Types + Minol mapping)

**What to build:** The Check Report catches Cost Items that Tenants can't be charged for. It uses two lists, both versioned with the Ruleset:

- a fixed list of Eligible Cost Types, derived from §7 para 2 HeizkostenV
- a mapping table from Minol's Cost Item names to that list

The AI extracts Cost Item names exactly as written, and H3 does the lookup. See the spec: module 2.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [x] The list of Eligible Cost Types covers every category in §7 para 2 HeizkostenV.
- [x] The mapping table maps each known Minol Cost Item name either to an Eligible Cost Type or to "not eligible".
- [x] The lookup ignores differences in whitespace and case, and nothing else.
- [x] A Cost Item mapped to "not eligible" raises an Error, with its amount as the amount at stake.
- [x] A Cost Item that isn't in the table raises a Warning naming the item exactly as written.
- [x] Tests cover known, ineligible and unknown names.
- [x] A planted-error fixture in which only H3 raises a Finding.
- [x] Changing either the list or the mapping table bumps the Ruleset version.

## Comments

**2026-10-02 (implementation, branch `feature/ticket-claude_code_impl`):**

- `rules/cost-types.ts` holds both tables: `ELIGIBLE_COST_TYPES` (nine categories from §7 Abs. 2 HeizkostenV, including the §6a consumption information) and `MINOL_COST_ITEMS`. `rules/h3.ts` does the lookup.
- Normalisation trims, collapses runs of whitespace and lowercases (`de-DE`). Anything else, such as punctuation, hyphens or "ae" for "ä", counts as an unknown name.
- One Finding per offending Cost Item, Errors before Warnings, all citing `§7 Abs. 2 HeizkostenV`, `affectedUnits: []`. The amount at stake is the item amount (null if the item has none), for Warnings too, as the spec gives one amount at stake for H3.
- H3 is Not assessable when the Building Statement lists no Cost Items. The spec doesn't define this case.
- **Version guard:** `rules/cost-types.test.ts` records a SHA-256 fingerprint of both tables per Ruleset version. Changing a table fails the test until `RULESET_VERSION` is bumped and a new fingerprint line is added. Any other version bump also needs a line, which may carry the same fingerprint.
- **Mapping to confirm with real Minol statements and the legal review:** the Minol names are a first guess at Minol's wording, not taken from real packages. "Wartung" maps to testing/setting, and "Tankreinigung" to cleaning. Not eligible: repairs, Instandsetzung/Instandhaltung, Kesseltausch, Verwaltungskosten, Mahngebühren, and Nutzerwechselgebühr/Zwischenablesung (BGH VIII ZR 19/07). The demo package's five items all map, so the demo shows no H3 Finding.
- **Left out on purpose (from the review):** `Fernwärme`/`Wärmelieferung` fall under §7 Abs. 4, not Abs. 2, so they raise a Warning for now. A district-heated building gets that Warning on every statement until a §7 Abs. 4 category is added. Meters are mapped only for heat and hot water. Cold-water meters are a BetrKV cost. "Wartung" is mapped as eligible, but maintenance contracts that include repairs are not. Raise this in the legal review.
- **Open:** names are not Unicode-normalised. If the Extractor returns a decomposed "ä" (NFD), a known name becomes a Warning. The ticket says "nothing else", so the decision is the user's.
- Ruleset version 0.4.0.

