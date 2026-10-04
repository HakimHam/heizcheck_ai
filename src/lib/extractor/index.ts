import { anthropicTransport } from './anthropic-transport'
import { createClaudeExtractor } from './claude'
import { createFakeExtractor } from './fake'
import type { Extractor } from './types'

export * from './types'
export { createClaudeExtractor, createFakeExtractor }

const MODES = ['fake', 'anthropic', 'bedrock'] as const
export type ExtractorMode = (typeof MODES)[number]

type Env = Record<string, string | undefined>

/** Which Extractor `EXTRACTOR` selects; the fake if it's unset. */
export function extractorMode(env: Env = process.env): ExtractorMode {
  const mode = env.EXTRACTOR || 'fake'
  if (!MODES.includes(mode as ExtractorMode)) {
    throw new Error(`EXTRACTOR must be one of ${MODES.join(', ')}, not "${mode}".`)
  }
  return mode as ExtractorMode
}

/** The Extractor the app uses, as `EXTRACTOR` selects it. */
export function appExtractor(env: Env = process.env): Extractor {
  switch (extractorMode(env)) {
    case 'fake':
      return createFakeExtractor()
    case 'anthropic':
      // Tenant data may only go to Claude through Bedrock in eu-west-1 (ADR 0003).
      if (env.VERCEL_ENV === 'production') {
        throw new Error('EXTRACTOR=anthropic is for development only and is refused in production.')
      }
      return createClaudeExtractor({ transport: anthropicTransport() })
    case 'bedrock':
      throw new Error('EXTRACTOR=bedrock is not implemented yet (ticket 17).')
  }
}
