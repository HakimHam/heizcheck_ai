import { describe, expect, it } from 'vitest'
import { formatTodayInGermany, todayInGermany } from './dates'

describe('formatTodayInGermany', () => {
  it('shows the date as DD.MM.YYYY', () => {
    expect(formatTodayInGermany(new Date('2026-10-07T10:00:00Z'))).toBe('07.10.2026')
  })

  // The day turns over at midnight in Berlin, not at midnight UTC.
  it('turns over at midnight Berlin summer time (UTC+2)', () => {
    expect(formatTodayInGermany(new Date('2026-10-06T21:59:59Z'))).toBe('06.10.2026')
    expect(formatTodayInGermany(new Date('2026-10-06T22:00:00Z'))).toBe('07.10.2026')
    expect(formatTodayInGermany(new Date('2026-10-06T22:00:01Z'))).toBe('07.10.2026')
  })

  it('turns over at midnight Berlin winter time (UTC+1), including the year', () => {
    expect(formatTodayInGermany(new Date('2026-12-31T22:59:59Z'))).toBe('31.12.2026')
    expect(formatTodayInGermany(new Date('2026-12-31T23:00:00Z'))).toBe('01.01.2027')
    expect(formatTodayInGermany(new Date('2026-12-31T23:00:01Z'))).toBe('01.01.2027')
  })
})

describe('todayInGermany', () => {
  it('returns the Berlin date as YYYY-MM-DD', () => {
    expect(todayInGermany(new Date('2026-10-06T22:00:00Z'))).toBe('2026-10-07')
  })
})
