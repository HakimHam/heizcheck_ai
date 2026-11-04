import { describe, expect, it } from 'vitest'
import { isValidGermanPostalCode } from './postal-code'

describe('isValidGermanPostalCode', () => {
  it('accepts exactly five digits', () => {
    expect(isValidGermanPostalCode('10115')).toBe(true)
    expect(isValidGermanPostalCode('99998')).toBe(true)
  })

  it('accepts a leading zero, e.g. Dresden', () => {
    expect(isValidGermanPostalCode('01067')).toBe(true)
  })

  it('rejects four and six digits, either side of five', () => {
    expect(isValidGermanPostalCode('1011')).toBe(false)
    expect(isValidGermanPostalCode('101155')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidGermanPostalCode('')).toBe(false)
  })

  it('rejects letters and other characters', () => {
    expect(isValidGermanPostalCode('1011a')).toBe(false)
    expect(isValidGermanPostalCode('D-10115')).toBe(false)
    expect(isValidGermanPostalCode('10-15')).toBe(false)
    expect(isValidGermanPostalCode('1011.')).toBe(false)
  })

  it('rejects whitespace around or inside the digits', () => {
    expect(isValidGermanPostalCode(' 10115')).toBe(false)
    expect(isValidGermanPostalCode('10115 ')).toBe(false)
    expect(isValidGermanPostalCode('10115\n')).toBe(false)
    expect(isValidGermanPostalCode('101 15')).toBe(false)
  })

  it('rejects digits that are not ASCII', () => {
    expect(isValidGermanPostalCode('１０１１５')).toBe(false) // full-width
    expect(isValidGermanPostalCode('١٠١١٥')).toBe(false) // Arabic-Indic
  })
})
