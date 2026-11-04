import type { Rule } from '../types'
import { periodInWindow, threePercentCutWarning } from './co2'

/** K2: the statement gives the total CO₂ or the split, so K1 has something to check. */
export const k2: Rule = ({ confirmedFigures: { building, units } }) => {
  const period = periodInWindow(building.billingPeriod)
  if ('status' in period) return period
  const { co2 } = building
  if (co2.totalKg !== null || co2.statedSplit !== null) return { status: 'passed' }
  return {
    status: 'finding',
    findings: [threePercentCutWarning('Die Abrechnung enthält keine CO₂-Angaben.', units)],
  }
}
