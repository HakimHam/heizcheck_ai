import { describe, expect, it } from 'vitest'
import { formatEuros } from './money'

// Intl puts a non-breaking space between the amount and the euro sign.
const eur = (amount: string) => `${amount} €`

describe('formatEuros', () => {
  it('formats euros with a decimal comma and two decimals', () => {
    expect(formatEuros(1234.56)).toBe(eur('1.234,56'))
    expect(formatEuros(1234.5)).toBe(eur('1.234,50'))
    expect(formatEuros(12)).toBe(eur('12,00'))
  })

  it('groups thousands with a dot from 1.000 on', () => {
    expect(formatEuros(999.99)).toBe(eur('999,99'))
    expect(formatEuros(1000)).toBe(eur('1.000,00'))
    expect(formatEuros(1000.01)).toBe(eur('1.000,01'))
    expect(formatEuros(1234567.89)).toBe(eur('1.234.567,89'))
  })

  it('rounds to the nearest cent, half a cent up', () => {
    expect(formatEuros(0.004)).toBe(eur('0,00'))
    expect(formatEuros(0.005)).toBe(eur('0,01'))
    expect(formatEuros(0.006)).toBe(eur('0,01'))
  })

  it('formats zero and negative amounts, e.g. a credit', () => {
    expect(formatEuros(0)).toBe(eur('0,00'))
    expect(formatEuros(-412.5)).toBe(eur('-412,50'))
  })

  it('refuses amounts that are not finite numbers', () => {
    expect(() => formatEuros(Number.NaN)).toThrow(RangeError)
    expect(() => formatEuros(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
