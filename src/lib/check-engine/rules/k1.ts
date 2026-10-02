import type { BillingPeriod, Co2Split } from '../../figures'
import type { Finding, Rule } from '../types'
import { formatShare } from './consumption-share'
import { formatTenths, intensityTenths, periodInWindow, periodShare, threePercentCutWarning, tierFor } from './co2'

/** Stated shares are decimals: closer than this counts as equal. */
const SHARE_TOLERANCE_PCT = 0.005

/**
 * K1: the Property Manager/Tenant CO₂ split follows the CO2KostAufG tier for
 * the building's kg CO₂/m²/year, and the statement shows how it was worked out.
 */
export const k1: Rule = ({ confirmedFigures: { building, units }, buildingProfile }) => {
  const period = periodInWindow(building.billingPeriod)
  if ('status' in period) return period
  const { co2 } = building
  if (co2.totalKg === null && co2.statedSplit === null) {
    return { status: 'not_assessable', reason: 'Die Abrechnung enthält keine CO₂-Angaben (siehe K2).' }
  }

  const missing = [
    co2.statedSplit === null && 'die Aufteilung der CO₂-Kosten',
    co2.statedTier === null && 'die Stufe',
    co2.totalKg === null && 'den CO₂-Ausstoß',
    co2.statedKgPerM2Year === null && 'den CO₂-Ausstoß je m² und Jahr',
  ].filter((text) => text !== false)
  const warning = missing.length
    ? threePercentCutWarning(`Die Abrechnung weist ${formatList(missing)} nicht aus.`, units)
    : null

  const livingArea = buildingProfile.livingAreaM2
  // Why the split can't be compared, or null when it can. The Warning still reports what is missing.
  const uncomparable =
    livingArea === null || livingArea <= 0
      ? 'Die Wohnfläche im Gebäudeprofil fehlt.'
      : buildingProfile.co2Reduction === 'heritage' || buildingProfile.co2Reduction === 'district_heating'
        ? 'Das Gebäudeprofil verzeichnet eine Einschränkung nach §9 CO2KostAufG, die diese Prüfung noch nicht berücksichtigt.'
        : null
  if (uncomparable && warning === null) return { status: 'not_assessable', reason: uncomparable }

  const error =
    uncomparable === null && livingArea !== null && co2.totalKg !== null && co2.statedSplit !== null
      ? splitError(co2.totalKg, livingArea, co2.statedSplit, co2.costCents, period)
      : null
  const findings = [error, warning].filter((finding) => finding !== null)
  return findings.length ? { status: 'finding', findings } : { status: 'passed' }
}

/** The Error when the stated split isn't the tier's, otherwise null. */
const splitError = (
  totalKg: number,
  livingAreaM2: number,
  stated: Co2Split,
  costCents: number | null,
  period: BillingPeriod,
): Finding | null => {
  const intensity = intensityTenths(totalKg, livingAreaM2)
  const share = periodShare(period)
  const expected = tierFor(intensity, share)
  const matches =
    Math.abs(stated.landlordPct - expected.landlordPct) < SHARE_TOLERANCE_PCT &&
    Math.abs(stated.tenantPct - expected.tenantPct) < SHARE_TOLERANCE_PCT
  if (matches) return null

  const scaled = share.periodDays < share.yearDays
  return {
    severity: 'error',
    legalReference: '§5 Abs. 1 CO2KostAufG',
    message:
      `Das Gebäude stößt ${formatTenths(intensity)} aus, das ist Stufe ${expected.tier}` +
      (scaled ? ` (Stufengrenzen anteilig gekürzt für ${share.periodDays} von ${share.yearDays} Tagen)` : '') +
      `: Der Vermieter trägt ${formatShare(expected.landlordPct)}, die Mieter tragen ` +
      `${formatShare(expected.tenantPct)} der CO₂-Kosten. Die Abrechnung teilt sie ` +
      `${formatShare(stated.landlordPct)} (Vermieter) zu ${formatShare(stated.tenantPct)} (Mieter) auf.`,
    affectedUnits: [],
    // Positive either way, like C1's difference; the message says which side carries too much.
    amountAtStakeCents:
      costCents === null ? null : Math.round((Math.abs(expected.landlordPct - stated.landlordPct) * costCents) / 100),
  }
}

/** `['a', 'b', 'c']` → `a, b und c` */
const formatList = (items: string[]) =>
  items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`
