// The check engine: fixed, deterministic rules over the Confirmed Figures and
// the Building Profile (ADR 0001). Pure: no I/O and no clock.
import { c1 } from './rules/c1'
import { c2 } from './rules/c2'
import { c3 } from './rules/c3'
import { h1 } from './rules/h1'
import { h2 } from './rules/h2'
import { h3 } from './rules/h3'
import { h4 } from './rules/h4'
import { h5 } from './rules/h5'
import { type CheckInput, type CheckReportContent, type Rule, type RuleId, RULE_IDS } from './types'

export * from './types'

/** Bump whenever a rule, the cost type mapping or the CO₂ tier table changes. */
export const RULESET_VERSION = '0.6.0'

const notYetImplemented: Rule = () => ({
  status: 'not_assessable',
  reason: 'Diese Prüfung ist noch nicht umgesetzt.',
})

const RULES: Record<RuleId, Rule> = {
  C1: c1,
  C2: c2,
  C3: c3,
  H1: h1,
  H2: h2,
  H3: h3,
  H4: h4,
  H5: h5,
  K1: notYetImplemented,
  K2: notYetImplemented,
  B1: notYetImplemented,
}

/** One Check Result per rule, in catalogue order. */
export function checkPackage(input: CheckInput): CheckReportContent {
  return {
    rulesetVersion: RULESET_VERSION,
    results: RULE_IDS.map((rule) => ({ rule, ...RULES[rule](input) })),
  }
}
