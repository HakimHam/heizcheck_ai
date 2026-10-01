import { describe, expect, it } from 'vitest'
import { buildingFormValues, parseBuildingForm } from './building-form'

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

const complete = {
  street: 'Lindenstraße 5',
  postalCode: '10115',
  city: 'Berlin',
  residential: 'ja',
  livingArea: '',
  heatedArea: '',
  mandatory70Pct: '',
  co2Reduction: '',
}

const profileOf = (fields: Record<string, string>) => {
  const result = parseBuildingForm(form({ ...complete, ...fields }))
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.building.profile
}

const errorsOf = (fields: Record<string, string>) => {
  const result = parseBuildingForm(form({ ...complete, ...fields }))
  if (result.ok) throw new Error('expected the form to be rejected')
  return result.errors
}

describe('parseBuildingForm', () => {
  it('stores every fact left blank as unknown', () => {
    expect(profileOf({})).toEqual({
      livingAreaM2: null,
      heatedAreaM2: null,
      mandatory70Pct: null,
      residential: true,
      co2Reduction: null,
    })
  })

  it('reads areas written the German way', () => {
    expect(profileOf({ livingArea: '812,45', heatedArea: '1.790,5' })).toMatchObject({
      livingAreaM2: 812.45,
      heatedAreaM2: 1790.5,
    })
  })

  it('distinguishes the 70% flag being set, false and unset', () => {
    expect(profileOf({ mandatory70Pct: 'ja' }).mandatory70Pct).toBe(true)
    expect(profileOf({ mandatory70Pct: 'nein' }).mandatory70Pct).toBe(false)
    expect(profileOf({ mandatory70Pct: '' }).mandatory70Pct).toBeNull()
  })

  it('records a non-residential building', () => {
    expect(profileOf({ residential: 'nein' }).residential).toBe(false)
  })

  it('reads each §9 CO₂ reduction, or leaves it unknown', () => {
    expect(profileOf({ co2Reduction: 'none' }).co2Reduction).toBe('none')
    expect(profileOf({ co2Reduction: 'heritage' }).co2Reduction).toBe('heritage')
    expect(profileOf({ co2Reduction: 'district_heating' }).co2Reduction).toBe('district_heating')
    expect(profileOf({ co2Reduction: '' }).co2Reduction).toBeNull()
  })

  it('reads the address', () => {
    const result = parseBuildingForm(form({ ...complete, street: '  Lindenstraße 5 ' }))
    expect(result.ok && result.building.address).toEqual({
      street: 'Lindenstraße 5',
      postalCode: '10115',
      city: 'Berlin',
    })
  })

  it('asks for a complete German address', () => {
    expect(errorsOf({ street: '', postalCode: '1011', city: ' ' })).toEqual({
      street: 'Bitte geben Sie Straße und Hausnummer an.',
      postalCode: 'Bitte geben Sie eine fünfstellige Postleitzahl an.',
      city: 'Bitte geben Sie den Ort an.',
    })
  })

  it('asks whether the building is residential rather than assuming it', () => {
    expect(errorsOf({ residential: '' })).toEqual({
      residential: 'Bitte geben Sie an, ob es sich um ein Wohngebäude handelt.',
    })
  })

  it('rejects areas that are not a positive number with at most two decimals', () => {
    const message = 'Bitte geben Sie eine Fläche größer als 0 m² mit höchstens zwei Nachkommastellen an.'
    for (const raw of ['abc', '0', '-12', '812,456', '12,5 m2']) {
      expect(errorsOf({ livingArea: raw, heatedArea: raw })).toEqual({
        livingArea: message,
        heatedArea: message,
      })
    }
  })

  it('accepts whole-number areas and a dot as thousands separator', () => {
    expect(profileOf({ livingArea: '812', heatedArea: '12.345' })).toMatchObject({
      livingAreaM2: 812,
      heatedAreaM2: 12345,
    })
  })

  it('reads back unchanged what the edit form is prefilled with', () => {
    const building = {
      address: { street: 'Lindenstraße 5', postalCode: '10115', city: 'Berlin' },
      profile: {
        livingAreaM2: 1812.45,
        heatedAreaM2: null,
        mandatory70Pct: false,
        residential: false,
        co2Reduction: 'district_heating' as const,
      },
    }
    expect(parseBuildingForm(form(buildingFormValues(building)))).toEqual({ ok: true, building })
  })

  it('prefills areas in German notation and unknown facts as blank', () => {
    expect(
      buildingFormValues({
        address: { street: 'Lindenstraße 5', postalCode: '10115', city: 'Berlin' },
        profile: {
          livingAreaM2: 812.4,
          heatedAreaM2: null,
          mandatory70Pct: true,
          residential: true,
          co2Reduction: null,
        },
      }),
    ).toEqual({ ...complete, livingArea: '812,4', mandatory70Pct: 'ja' })
  })
})
