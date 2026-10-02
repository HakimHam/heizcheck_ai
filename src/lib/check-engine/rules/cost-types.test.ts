import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { RULESET_VERSION } from '..'
import { ELIGIBLE_COST_TYPES, MINOL_COST_ITEMS, normaliseCostItemName } from './cost-types'

// The fingerprint of the Eligible Cost Types and the Minol mapping at each
// Ruleset version. Changing either table means bumping RULESET_VERSION and
// adding a line here; never overwrite an existing one.
const FINGERPRINTS: Record<string, string> = {
  '0.4.0': '9967d03eb59545e71fdd298d8762d34ceda580ff38ca771ae9c59d7933301768',
}

const fingerprint = () =>
  createHash('sha256').update(JSON.stringify({ ELIGIBLE_COST_TYPES, MINOL_COST_ITEMS })).digest('hex')

describe('the Minol mapping table', () => {
  it('maps at least one Minol name to every Eligible Cost Type', () => {
    const mapped = new Set(Object.values(MINOL_COST_ITEMS))
    expect(Object.keys(ELIGIBLE_COST_TYPES).filter((type) => !mapped.has(type as never))).toEqual([])
  })

  it('has no two names that only differ in whitespace and case', () => {
    const names = Object.keys(MINOL_COST_ITEMS).map(normaliseCostItemName)
    expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([])
  })
})

describe('the Ruleset version', () => {
  it('is bumped whenever the Eligible Cost Types or the Minol mapping change', () => {
    expect(
      fingerprint(),
      `The cost type tables changed: bump RULESET_VERSION and record ${fingerprint()} for it.`,
    ).toBe(FINGERPRINTS[RULESET_VERSION])
  })
})
