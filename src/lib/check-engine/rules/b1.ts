import { formatDate } from '../../dates'
import type { IsoDate } from '../../figures'
import type { Rule } from '../types'

/** Four weeks (§188 Abs. 2 BGB). The Warning starts this many days before the deadline. */
const WARNING_DAYS = 28

const toUtc = (date: IsoDate) => {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

const toIsoDate = (utc: number): IsoDate => new Date(utc).toISOString().slice(0, 10)

/**
 * The Billing Period end + 12 calendar months (§188 Abs. 2 BGB). When the
 * target month has no such day, the deadline is its last day (§188 Abs. 3 BGB).
 */
const deadline = (periodEnd: IsoDate): IsoDate => {
  const [year, month, day] = periodEnd.split('-').map(Number)
  const lastDayOfTargetMonth = new Date(Date.UTC(year + 1, month, 0)).getUTCDate()
  return toIsoDate(Date.UTC(year + 1, month - 1, Math.min(day, lastDayOfTargetMonth)))
}

const daysBetween = (from: IsoDate, to: IsoDate) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000)

/** B1: the Unit Statements go out by the §556 Abs. 3 BGB deadline, judged by the Dispatch Date passed in. */
export const b1: Rule = ({ confirmedFigures: { building }, dispatchDate }) => {
  const period = building.billingPeriod
  if (period === null) {
    return {
      status: 'not_assessable',
      reason: 'Der Abrechnungszeitraum der Gesamtabrechnung fehlt.',
    }
  }

  const due = deadline(period.end)
  const daysLeft = daysBetween(dispatchDate, due)
  if (daysLeft > WARNING_DAYS) return { status: 'passed' }

  const late = daysLeft < 0
  const deadlineText =
    `Der Abrechnungszeitraum endet am ${formatDate(period.end)}, die Abrechnung muss den Mietern ` +
    `bis zum ${formatDate(due)} zugehen. `
  const sent = `Das Versanddatum ${formatDate(dispatchDate)}`
  return {
    status: 'finding',
    findings: [
      {
        severity: late ? 'error' : 'warning',
        legalReference: '§556 Abs. 3 BGB',
        message: late
          ? deadlineText +
            `${sent} liegt ${daysLeft === -1 ? 'einen Tag' : `${-daysLeft} Tage`} danach. ` +
            'Nachforderungen sind ausgeschlossen, es sei denn, der Vermieter hat die Verspätung nicht zu vertreten.'
          : deadlineText +
            (daysLeft === 0
              ? `${sent} ist der letzte Tag der Frist. `
              : `${sent} lässt nur ${daysLeft === 1 ? 'einen Tag' : `${daysLeft} Tage`}. `) +
            'Bitte so versenden, dass der Zugang rechtzeitig nachweisbar ist.',
        affectedUnits: [],
        amountAtStakeCents: null,
      },
    ],
  }
}
