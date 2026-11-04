import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { RULESET_VERSION } from '..'
import { CO2_TIERS } from './co2'

// The fingerprint of the CO₂ tier table at each Ruleset version. Changing the
// table means bumping RULESET_VERSION and adding a line here; never overwrite
// an existing one.
const FINGERPRINTS: Record<string, string> = {
  '0.8.0': '0ee3af70d916e76e4853d10fc67a93c5ac4bc7c45c751a24378a9c9c10fce84e',
  '0.9.0': '0ee3af70d916e76e4853d10fc67a93c5ac4bc7c45c751a24378a9c9c10fce84e',
}

const fingerprint = () => createHash('sha256').update(JSON.stringify(CO2_TIERS)).digest('hex')

describe('the CO₂ tier table', () => {
  it('has ten tiers that follow on from each other, each splitting 100%', () => {
    expect(CO2_TIERS.map((t) => t.tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    CO2_TIERS.forEach((t, i) => {
      expect(t.tenantPct + t.landlordPct).toBe(100)
      expect(t.belowKg).toBe(CO2_TIERS[i + 1]?.fromKg ?? null)
    })
  })

  it('is fingerprinted at each Ruleset version', () => {
    expect(
      fingerprint(),
      `The CO₂ tier table changed: bump RULESET_VERSION and record ${fingerprint()} for it.`,
    ).toBe(FINGERPRINTS[RULESET_VERSION])
  })
})
