import type { BuildingProfile } from '../building-profile'
import type { Figures, IsoDate } from '../figures'

/** The catalogue of rules, in the order every Check Report lists them. */
export const RULE_IDS = ['C1', 'C2', 'C3', 'H1', 'H2', 'H3', 'H4', 'H5', 'K1', 'K2', 'B1'] as const
export type RuleId = (typeof RULE_IDS)[number]

export type CheckInput = {
  confirmedFigures: Figures
  buildingProfile: BuildingProfile
  /** When the Unit Statements go to Tenants. Passed in: the engine has no clock. */
  dispatchDate: IsoDate
}

export type Severity = 'error' | 'warning'

export type Finding = {
  severity: Severity
  /** e.g. "§5 Abs. 1 CO2KostAufG" */
  legalReference: string
  /** German. */
  message: string
  /** Empty means the whole building. */
  affectedUnits: string[]
  amountAtStakeCents: number | null
}

/** A Check Result before the engine stamps the rule's id on it. */
export type RuleResult =
  | { status: 'passed' }
  | { status: 'not_assessable'; reason: string }
  | { status: 'finding'; findings: Finding[] }

export type CheckResult = { rule: RuleId } & RuleResult

export type Rule = (input: CheckInput) => RuleResult

export type CheckReportContent = { rulesetVersion: string; results: CheckResult[] }
