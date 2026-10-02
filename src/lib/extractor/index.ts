import { createFakeExtractor } from './fake'
import type { Extractor } from './types'

export * from './types'
export { createFakeExtractor }

/** The Extractor the app uses. The fake until the Bedrock adapter lands (ticket 11). */
export function appExtractor(): Extractor {
  return createFakeExtractor()
}
