import { describe, expect, it } from 'vitest'
import { type BuildingProfile, unknownFacts } from './building-profile'

const complete: BuildingProfile = {
  livingAreaM2: 812.45,
  heatedAreaM2: 790.5,
  mandatory70Pct: false,
  residential: true,
  co2Reduction: 'none',
}

describe('unknownFacts', () => {
  it('reports nothing for a complete Building Profile', () => {
    expect(unknownFacts(complete)).toEqual([])
  })

  it('names each fact that is still unknown, in German', () => {
    expect(
      unknownFacts({ ...complete, livingAreaM2: null, mandatory70Pct: null, co2Reduction: null }),
    ).toEqual(['Wohnfläche', '70-%-Pflicht (§7 HeizkostenV)', 'CO₂-Einschränkung (§9 CO2KostAufG)'])
  })

  it('treats a recorded "no" as known', () => {
    expect(unknownFacts({ ...complete, mandatory70Pct: false, co2Reduction: 'none' })).toEqual([])
  })
})
