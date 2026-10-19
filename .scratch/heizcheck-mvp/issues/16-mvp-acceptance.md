# 16: MVP acceptance: clean package, all planted errors, real-package run

**What to build:** Proof that the MVP meets its success criteria:

- A clean Statement Package passes all 11 rules.
- For each rule, a copy of the package with one planted error is caught by exactly that rule.
- A Property Manager checks a real Minol package in under 10 minutes.

See `docs/mvp-scope.md`: Success criteria.

**Blocked by:** 04, 05, 06, 07, 08, 09, 10, 11, 12, 17.

**Status:** ready-for-human

**Automated checks**

- [x] A "clean package" fixture in which every rule returns Passed. (`cleanPackage` in `src/lib/check-engine/fixtures.ts`; verified 2026-10-17.)
- [x] The full planted-error suite: one copy per rule, each caught by exactly that rule. (All 11 rules in `plantedErrors`; the one documented overlap is H4 also raising H5, see `alsoRaised`. `planted-errors.test.ts` 12/12 passed on 2026-10-17.)
- [ ] Tests for the check engine's invariants:
  - exactly one Check Result per rule
  - the same input always gives the same output
  - the Ruleset version is stamped
  - every Finding has a legal reference
- [ ] The extraction eval reaches ≥ 95% correct figures on 5–10 real Minol packages.

**Human checks**

- [ ] One Property Manager checks a real package end to end in under 10 minutes. Time the run and note the result under Comments.
- [ ] Before any real data is processed:
  - Bedrock data retention is set to `none` in `eu-west-1`
  - `allowed_modes` includes `none`
  - the AWS GDPR Data Processing Addendum is signed
- [ ] A qualified person has reviewed the Ruleset (see the spec's Further Notes).
