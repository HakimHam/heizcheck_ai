import type { Co2Reduction } from '../../building-profile'
import type { BillingPeriod, Co2Split, StatedReduction } from '../../figures'
import type { Finding, Rule } from '../types'
import { formatShare } from './consumption-share'
import {
  type Co2Tier,
  formatTenths,
  intensityTenths,
  type PeriodShare,
  periodInWindow,
  periodShare,
  threePercentCutWarning,
  tierFor,
} from './co2'

/** Stated shares are decimals: closer than this counts as equal. */
const SHARE_TOLERANCE_PCT = 0.005

type Reduction = {
  /** What the statement claims for this reduction. */
  stated: StatedReduction
  split: (tier: Co2Tier) => Co2Split
  /** Says in the split Error why the tier's split doesn't apply. */
  note: string
  /** Says in the claim Warning what the Building Profile records. */
  recordedAs: string
}

/** The §9 CO2KostAufG reductions the Building Profile can record. */
const REDUCTIONS: Record<Co2Reduction, Reduction> = {
  none: {
    stated: 'none',
    split: ({ landlordPct, tenantPct }) => ({ landlordPct, tenantPct }),
    note: '',
    recordedAs: 'keine Einschränkung',
  },
  heritage: {
    stated: 'halved',
    split: ({ landlordPct }) => ({ landlordPct: landlordPct / 2, tenantPct: 100 - landlordPct / 2 }),
    note: ', nach §9 CO2KostAufG wegen Denkmalschutz halbiert',
    recordedAs: 'Denkmalschutz',
  },
  district_heating: {
    stated: 'no_split',
    split: () => ({ landlordPct: 0, tenantPct: 100 }),
    note: ', nach §9 CO2KostAufG wegen der Pflicht zur Nutzung von Fernwärme ohne Aufteilung',
    recordedAs: 'die Pflicht zur Nutzung von Fernwärme',
  },
}

const CLAIMED: Record<Exclude<StatedReduction, 'none'>, string> = {
  halved: 'Vermieteranteil halbiert',
  no_split: 'keine Aufteilung',
}

/**
 * K1: the Property Manager/Tenant CO₂ split follows the CO2KostAufG tier for
 * the building's kg CO₂/m²/year, as reduced by §9, and the statement's own
 * kg CO₂/m²/year and tier are the ones the figures produce. The statement must
 * also show how it was worked out.
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
  const cutWarning = missing.length
    ? threePercentCutWarning(`Die Abrechnung weist ${formatList(missing)} nicht aus.`, units)
    : null

  // Unknown counts as no reduction: the claim Warning then asks for the Building Profile to be completed.
  const recorded = buildingProfile.co2Reduction
  const reduction = REDUCTIONS[recorded ?? 'none']
  const claimWarning =
    co2.statedReduction !== null && co2.statedReduction !== 'none' && co2.statedReduction !== reduction.stated
      ? reductionClaimWarning(co2.statedReduction, recorded)
      : null

  // The figures to compare against, or null without the living area or the total CO₂.
  const livingArea = buildingProfile.livingAreaM2
  const expected =
    livingArea !== null && livingArea > 0 && co2.totalKg !== null ? expectedCo2(co2.totalKg, livingArea, period) : null
  if (expected === null && cutWarning === null && claimWarning === null) {
    return { status: 'not_assessable', reason: 'Die Wohnfläche im Gebäudeprofil fehlt.' }
  }

  const errors = expected
    ? [
        co2.statedSplit === null ? null : splitError(expected, reduction, co2.statedSplit, co2.costCents),
        figuresError(expected, co2.statedKgPerM2Year, co2.statedTier),
      ]
    : []
  const findings = [...errors, claimWarning, cutWarning].filter((finding) => finding !== null)
  return findings.length ? { status: 'finding', findings } : { status: 'passed' }
}

/** The kg CO₂/m²/year and tier the figures produce, and the share of a year the limits are scaled to. */
type ExpectedCo2 = { intensity: number; share: PeriodShare; tier: Co2Tier }

const expectedCo2 = (totalKg: number, livingAreaM2: number, period: BillingPeriod): ExpectedCo2 => {
  const intensity = intensityTenths(totalKg, livingAreaM2)
  const share = periodShare(period)
  return { intensity, share, tier: tierFor(intensity, share) }
}

/** `28,4 kg CO₂/m²/Jahr, das ist Stufe 5 (…gekürzt…)` */
const describeExpected = ({ intensity, share, tier }: ExpectedCo2) =>
  `${formatTenths(intensity)}, das ist Stufe ${tier.tier}` +
  (share.periodDays < share.yearDays
    ? ` (Stufengrenzen anteilig gekürzt für ${share.periodDays} von ${share.yearDays} Tagen)`
    : '')

/** The Error when the stated split isn't the tier's as reduced by §9, otherwise null. */
const splitError = (
  co2: ExpectedCo2,
  reduction: Reduction,
  stated: Co2Split,
  costCents: number | null,
): Finding | null => {
  const expected = reduction.split(co2.tier)
  const matches =
    Math.abs(stated.landlordPct - expected.landlordPct) < SHARE_TOLERANCE_PCT &&
    Math.abs(stated.tenantPct - expected.tenantPct) < SHARE_TOLERANCE_PCT
  if (matches) return null

  return {
    severity: 'error',
    legalReference: reduction.stated === 'none' ? '§5 Abs. 1 CO2KostAufG' : '§5 Abs. 1, §9 CO2KostAufG',
    message:
      `Das Gebäude stößt ${describeExpected(co2)}${reduction.note}: Der Vermieter trägt ` +
      `${formatShare(expected.landlordPct)}, die Mieter tragen ${formatShare(expected.tenantPct)} der CO₂-Kosten. ` +
      `Die Abrechnung teilt sie ${formatShare(stated.landlordPct)} (Vermieter) zu ` +
      `${formatShare(stated.tenantPct)} (Mieter) auf.`,
    affectedUnits: [],
    // Positive either way, like C1's difference; the message says which side carries too much.
    amountAtStakeCents:
      costCents === null ? null : Math.round((Math.abs(expected.landlordPct - stated.landlordPct) * costCents) / 100),
  }
}

/**
 * The Error when the statement's kg CO₂/m²/year (compared rounded to one
 * decimal) or tier isn't what the figures produce, otherwise null. Its money is
 * in the split, so nothing is at stake here.
 */
const figuresError = (expected: ExpectedCo2, statedKg: number | null, statedTier: number | null): Finding | null => {
  const statedTenths = statedKg === null ? null : Math.round(statedKg * 10)
  const wrong = [
    statedTenths !== null && statedTenths !== expected.intensity && formatTenths(statedTenths),
    statedTier !== null && statedTier !== expected.tier.tier && `Stufe ${statedTier}`,
  ].filter((text) => text !== false)
  if (!wrong.length) return null

  return {
    severity: 'error',
    legalReference: '§5 Abs. 1 CO2KostAufG',
    message:
      `Die Abrechnung weist ${formatList(wrong)} aus. Aus dem CO₂-Ausstoß und der Wohnfläche im Gebäudeprofil ` +
      `ergeben sich ${describeExpected(expected)}. Bitte die Berechnung beim Messdienstleister klären.`,
    affectedUnits: [],
    amountAtStakeCents: null,
  }
}

/** The Warning when the statement claims a §9 reduction the Building Profile doesn't record. */
const reductionClaimWarning = (claimed: Exclude<StatedReduction, 'none'>, recorded: Co2Reduction | null): Finding => ({
  severity: 'warning',
  legalReference: '§9 CO2KostAufG',
  message:
    `Die Abrechnung beruft sich auf eine Einschränkung nach §9 CO2KostAufG (${CLAIMED[claimed]}). ` +
    (recorded === null
      ? 'Das Gebäudeprofil gibt nicht an, ob eine Einschränkung besteht. Bitte das Gebäudeprofil ergänzen.'
      : `Das Gebäudeprofil verzeichnet ${REDUCTIONS[recorded].recordedAs}. Bitte prüfen, ob die Einschränkung ` +
        'besteht, und das Gebäudeprofil anpassen oder die Aufteilung beim Messdienstleister korrigieren lassen.'),
  affectedUnits: [],
  amountAtStakeCents: null,
})

/** `['a', 'b', 'c']` → `a, b und c` */
const formatList = (items: string[]) =>
  items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`
