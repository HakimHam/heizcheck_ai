import { describe, expect, it } from 'vitest'
import { type CheckInput, checkPackage, type RuleId } from '.'
import { alsoRaised, cleanPackage, plantedErrors } from './fixtures'

const rulesWithFindings = (input: CheckInput): RuleId[] =>
  checkPackage(input)
    .results.filter((r) => r.status === 'finding')
    .map((r) => r.rule)

describe('planted-error fixtures', () => {
  it('raises no Finding for the clean package', () => {
    expect(rulesWithFindings(cleanPackage)).toEqual([])
  })

  for (const [rule, input] of Object.entries(plantedErrors)) {
    const also = alsoRaised[rule as RuleId] ?? []
    it(`catches the error planted for ${rule}, and only that rule raises a Finding${also.length ? ` (besides ${also.join(', ')})` : ''}`, () => {
      expect(rulesWithFindings(input)).toEqual([rule, ...also])
    })
  }
})
