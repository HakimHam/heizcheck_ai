import type { Rule } from '../types'
import { isWithinRange, outOfRangeError } from './consumption-share'

/** H2: the hot water consumption share is 50–70%. */
export const h2: Rule = ({ confirmedFigures: { building } }) => {
  const share = building.hotWaterConsumptionSharePct
  if (share === null) {
    return {
      status: 'not_assessable',
      reason: 'Das Paket weist keinen Verbrauchsanteil für Warmwasser aus.',
    }
  }
  if (isWithinRange(share)) return { status: 'passed' }

  return {
    status: 'finding',
    findings: [outOfRangeError('§8 Abs. 1 HeizkostenV', 'Warmwasserkosten', share)],
  }
}
