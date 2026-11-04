// Shared by H1 and H2: both §7 and §8 HeizkostenV allow a 50–70% consumption share.
import type { Finding, Severity } from '../types'

export const MIN_SHARE_PCT = 50
export const MAX_SHARE_PCT = 70

const PERCENT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
export const formatShare = (pct: number) => `${PERCENT.format(pct)} %`

export const isWithinRange = (pct: number) => pct >= MIN_SHARE_PCT && pct <= MAX_SHARE_PCT

/** A share applies to every Unit alike, so its Findings name the whole building. */
export const buildingFinding = (severity: Severity, legalReference: string, message: string): Finding => ({
  severity,
  legalReference,
  message,
  affectedUnits: [],
  amountAtStakeCents: null,
})

/** The Error for a share outside 50–70%. `costs` is e.g. "Heizkosten". */
export const outOfRangeError = (legalReference: string, costs: string, share: number): Finding =>
  buildingFinding(
    'error',
    legalReference,
    `Die ${costs} werden zu ${formatShare(share)} nach Verbrauch verteilt. ` +
      `Zulässig ist ein Verbrauchsanteil zwischen ${formatShare(MIN_SHARE_PCT)} und ${formatShare(MAX_SHARE_PCT)}.`,
  )
