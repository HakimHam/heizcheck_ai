# 09: K1 extensions: §9 reductions and the statement's own figures

**What to build:** K1 accepts the reduced landlord share that §9 CO2KostAufG allows for heritage-protected buildings and for buildings that must use district heating. It also checks the kg CO₂/m²/year and the tier that the statement itself gives. See the spec: Rule semantics for K1, steps 4 and 5.

**Blocked by:** 08 (Rules K1 + K2 core).

**Status:** ready-for-agent

- [ ] When the Building Profile records heritage protection, the expected landlord share is half of the tier's share.
- [ ] When the Building Profile records required district heating, the expected result is no split.
- [ ] A Warning when the statement claims a §9 reduction that the Building Profile doesn't record.
- [ ] When the Building Profile records a reduction that the statement doesn't apply, K1 raises the split Error.
- [ ] An Error when the stated kg/m²/year or the stated tier doesn't match the computed one (§5 para 1), even if the stated split is correct.
- [ ] Tests cover each case above.
