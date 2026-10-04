import { describe, expect, it } from 'vitest'
import { currentOf, currentPackages, historyOf } from './package-history'

// Newest first, as listPackages returns them.
const pkg = (id: string, supersededBy: string | null, createdAt: string) => ({ id, supersededBy, createdAt })
const third = pkg('c', null, '2026-03-01T00:00:00Z')
const second = pkg('b', 'c', '2026-02-01T00:00:00Z')
const first = pkg('a', 'b', '2026-01-01T00:00:00Z')
const otherPeriod = pkg('x', null, '2025-06-01T00:00:00Z')
const packages = [third, second, first, otherPeriod]

describe('currentPackages', () => {
  it('leaves out Superseded Packages, keeping the order', () => {
    expect(currentPackages(packages)).toEqual([third, otherPeriod])
  })
})

describe('currentOf', () => {
  it('follows the corrections to the current package', () => {
    expect(currentOf(packages, first)).toBe(third)
    expect(currentOf(packages, second)).toBe(third)
  })

  it('is the package itself when it is current', () => {
    expect(currentOf(packages, third)).toBe(third)
    expect(currentOf(packages, otherPeriod)).toBe(otherPeriod)
  })
})

describe('historyOf', () => {
  it('lists every package for the same building and Billing Period, oldest first', () => {
    expect(historyOf(packages, third)).toEqual([first, second, third])
    expect(historyOf(packages, first)).toEqual([first, second, third])
  })

  it('includes an older upload superseded straight by the current package', () => {
    const late = pkg('l', 'c', '2026-01-15T00:00:00Z')
    expect(historyOf([...packages, late], second)).toEqual([first, late, second, third])
  })

  it('is just the package when it was never corrected', () => {
    expect(historyOf(packages, otherPeriod)).toEqual([otherPeriod])
  })
})
