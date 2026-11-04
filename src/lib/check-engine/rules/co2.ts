// Shared by K1 and K2: the CO2KostAufG tier table, its time window and the CO₂ intensity.
import { daysBetween, formatDate, toUtc } from '../../dates'
import type { BillingPeriod, IsoDate, UnitFigures } from '../../figures'
import type { Finding } from '../types'

export type Co2Tier = {
  /** 1–10 */
  tier: number
  /** kg CO₂/m²/year, included. */
  fromKg: number
  /** kg CO₂/m²/year, excluded. null for the top tier. */
  belowKg: number | null
  tenantPct: number
  landlordPct: number
}

/**
 * The annex to the CO2KostAufG (BGBl. I 2022, 2159). The statute lists the
 * Tenants' column first, so the shares are named fields, never positional pairs.
 */
export const CO2_TIERS: readonly Co2Tier[] = [
  { tier: 1, fromKg: 0, belowKg: 12, tenantPct: 100, landlordPct: 0 },
  { tier: 2, fromKg: 12, belowKg: 17, tenantPct: 90, landlordPct: 10 },
  { tier: 3, fromKg: 17, belowKg: 22, tenantPct: 80, landlordPct: 20 },
  { tier: 4, fromKg: 22, belowKg: 27, tenantPct: 70, landlordPct: 30 },
  { tier: 5, fromKg: 27, belowKg: 32, tenantPct: 60, landlordPct: 40 },
  { tier: 6, fromKg: 32, belowKg: 37, tenantPct: 50, landlordPct: 50 },
  { tier: 7, fromKg: 37, belowKg: 42, tenantPct: 40, landlordPct: 60 },
  { tier: 8, fromKg: 42, belowKg: 47, tenantPct: 30, landlordPct: 70 },
  { tier: 9, fromKg: 47, belowKg: 52, tenantPct: 20, landlordPct: 80 },
  { tier: 10, fromKg: 52, belowKg: null, tenantPct: 5, landlordPct: 95 },
]

/**
 * kg CO₂/m²/year in whole tenths, rounded half up to one decimal (§5 Abs. 1
 * Satz 3 CO2KostAufG). Worked in thousandths of a kg and of a m², so the
 * rounding is exact.
 */
export const intensityTenths = (totalKg: number, livingAreaM2: number) => {
  const kgMilli = Math.round(totalKg * 1000)
  const areaMilli = Math.round(livingAreaM2 * 1000)
  return Math.floor((kgMilli * 20 + areaMilli) / (areaMilli * 2))
}

/**
 * The tier for an intensity. The limits are scaled by `periodDays / yearDays`
 * for a Billing Period shorter than 12 months (§5 Abs. 1 Satz 4), compared in
 * integers: tenths × yearDays against limit × 10 × periodDays.
 */
export const tierFor = (tenths: number, { periodDays, yearDays }: PeriodShare): Co2Tier =>
  CO2_TIERS.findLast((t) => tenths * yearDays >= t.fromKg * 10 * periodDays) ?? CO2_TIERS[0]

const KG = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const formatTenths = (tenths: number) => `${KG.format(tenths / 10)} kg CO₂/m²/Jahr`

/** §11 Abs. 2 CO2KostAufG: the Act applies to Billing Periods starting on or after this day. */
const FIRST_START: IsoDate = '2023-01-01'
/** From this day the 2026 amendment splits some systems 50/50, which the Ruleset doesn't cover yet. */
const AMENDMENT_START: IsoDate = '2028-01-01'

type NotAssessable = { status: 'not_assessable'; reason: string }

/** The Billing Period, or Not assessable when it is missing or the Ruleset can't back a result for it. */
export const periodInWindow = (period: BillingPeriod | null): BillingPeriod | NotAssessable => {
  if (period === null) {
    return { status: 'not_assessable', reason: 'Der Abrechnungszeitraum der Gesamtabrechnung fehlt.' }
  }
  if (period.start < FIRST_START) {
    return {
      status: 'not_assessable',
      reason:
        `Der Abrechnungszeitraum beginnt am ${formatDate(period.start)}. Das CO2KostAufG gilt erst für ` +
        `Abrechnungszeiträume ab dem ${formatDate(FIRST_START)} (§11 Abs. 2 CO2KostAufG).`,
    }
  }
  if (period.start >= AMENDMENT_START) {
    return {
      status: 'not_assessable',
      reason:
        `Der Abrechnungszeitraum beginnt am ${formatDate(period.start)}. Für Abrechnungszeiträume ab dem ` +
        `${formatDate(AMENDMENT_START)} gilt die Änderung des CO2KostAufG von 2026, die diese Prüfung noch nicht abdeckt.`,
    }
  }
  return period
}

export type PeriodShare = { periodDays: number; yearDays: number }

/**
 * The Billing Period's days and the days in the 12 months from its start, for
 * scaling the tier limits. A period of 12 months or more counts as a full year.
 */
export const periodShare = ({ start, end }: BillingPeriod): PeriodShare => {
  const [year, month, day] = start.split('-').map(Number)
  const yearDays = Math.round((Date.UTC(year + 1, month - 1, day) - toUtc(start)) / 86_400_000)
  const periodDays = daysBetween(start, end) + 1
  return { periodDays: Math.min(periodDays, yearDays), yearDays }
}

/** The Tenant's 3% cut applies to every Unit amount (§7 Abs. 4 CO2KostAufG). null when one is missing. */
const threePercentOf = (units: UnitFigures[]) =>
  units.some((unit) => unit.amountCents === null)
    ? null
    : Math.round(units.reduce((total, unit) => total + (unit.amountCents ?? 0), 0) * 0.03)

/** The Warning for CO₂ information the statement doesn't give. `missing` starts the message. */
export const threePercentCutWarning = (missing: string, units: UnitFigures[]): Finding => ({
  severity: 'warning',
  legalReference: '§7 Abs. 3, 4 CO2KostAufG',
  message:
    `${missing} Der Vermieter muss den Mietern die Aufteilung der CO₂-Kosten, die Einstufung des Gebäudes ` +
    'und ihre Berechnungsgrundlagen mitteilen. Fehlen diese Angaben, dürfen die Mieter ihren Anteil an den ' +
    'Heizkosten um 3 % kürzen. Bitte die Angaben beim Messdienstleister anfordern.',
  affectedUnits: [],
  amountAtStakeCents: threePercentOf(units),
})
