import { describe, expect, it } from 'vitest'
import type { CheckResult, Finding } from './check-engine'
import { orderForReport, summarise } from './check-report'

const finding = (severity: Finding['severity']): Finding => ({
  severity,
  legalReference: '§6 Abs. 1 HeizkostenV',
  message: 'x',
  affectedUnits: [],
  amountAtStakeCents: null,
})

const results: CheckResult[] = [
  { rule: 'C1', status: 'passed' },
  { rule: 'C2', status: 'not_assessable', reason: 'fehlt' },
  { rule: 'C3', status: 'finding', findings: [finding('warning')] },
  { rule: 'H1', status: 'finding', findings: [finding('warning'), finding('error')] },
  { rule: 'H2', status: 'passed' },
  { rule: 'H3', status: 'finding', findings: [finding('error')] },
]

describe('orderForReport', () => {
  it('lists Errors before Warnings, then Not assessable, then Passed, keeping catalogue order', () => {
    expect(orderForReport(results).map((r) => r.rule)).toEqual(['H1', 'H3', 'C3', 'C2', 'C1', 'H2'])
  })

  it('lists a Check Result’s Errors before its Warnings', () => {
    const h1 = orderForReport(results).find((r) => r.rule === 'H1')
    expect(h1?.status === 'finding' && h1.findings.map((f) => f.severity)).toEqual([
      'error',
      'warning',
    ])
  })
})

describe('summarise', () => {
  it('counts Findings by Severity and the rules that could not be assessed', () => {
    expect(summarise(results)).toEqual({ errors: 2, warnings: 2, notAssessable: 1 })
  })
})
