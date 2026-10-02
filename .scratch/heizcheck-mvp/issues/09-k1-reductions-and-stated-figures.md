# 09: K1 extensions: §9 reductions and the statement's own figures

**What to build:** K1 accepts the reduced landlord share that §9 CO2KostAufG allows for heritage-protected buildings and for buildings that must use district heating. It also checks the kg CO₂/m²/year and the tier that the statement itself gives. See the spec: Rule semantics for K1, steps 4 and 5.

**Blocked by:** 08 (Rules K1 + K2 core).

**Status:** ready-for-agent

- [x] When the Building Profile records heritage protection, the expected landlord share is half of the tier's share.
- [x] When the Building Profile records required district heating, the expected result is no split.
- [x] A Warning when the statement claims a §9 reduction that the Building Profile doesn't record.
- [x] When the Building Profile records a reduction that the statement doesn't apply, K1 raises the split Error.
- [x] An Error when the stated kg/m²/year or the stated tier doesn't match the computed one (§5 para 1), even if the stated split is correct.
- [x] Tests cover each case above.

## Comments

**2026-10-02 (implementation, branch `feature/ticket-claude_code_impl`):**

- **§9 reductions** live in one map in `rules/k1.ts` (`REDUCTIONS`, keyed by the Building Profile's `co2Reduction`):
  - Heritage protection halves the tier's Property Manager share, and the Tenants carry the rest. Tier 10 becomes 47.5/52.5.
  - Required district heating expects 0/100.
  - The split Error then cites `§5 Abs. 1, §9 CO2KostAufG` and its message names the reduction. A recorded reduction the statement doesn't apply is caught by this Error, with |expected − stated| × the CO₂ cost at stake.
- **Claim Warning** (`§9 CO2KostAufG`, nothing at stake): raised when the statement claims `halved` or `no_split` and that isn't the reduction the Building Profile records. The message names what the profile records. A statement claiming `none`, or nothing, is never warned about.
- **Unknown reduction:** when the Building Profile's reduction is unset, K1 counts it as no reduction. If the statement claims one, the claim Warning asks for the Building Profile to be completed. If that claimed split is reduced, the split Error is raised too.
- **The statement's own figures** (`§5 Abs. 1 CO2KostAufG`, nothing at stake, because the money is in the split): an Error when the stated kg/m²/year, rounded half up to one decimal, or the stated tier isn't what the figures produce. For short Billing Periods that means the tier with the scaled-down limits. This is checked even when the split is right or missing.
- **Finding order:** split Error, figures Error, claim Warning, 3% Warning.
- **Not assessable:** K1 is Not assessable without the living area only when it has no Warning to give, as in #08. It is no longer Not assessable for a §9 reduction.
- The K1 test helper now prints, by default, the kg/m²/year the figures produce and the tier matching the stated split (taken from `CO2_TIERS`), so the older tests keep testing only the split.
- Ruleset version 0.9.0. The tier and cost type tables are unchanged, so their fingerprints are carried over.
