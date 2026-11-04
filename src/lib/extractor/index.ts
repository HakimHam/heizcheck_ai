import { anthropicTransport } from './anthropic-transport'
import { createClaudeExtractor } from './claude'
import { createFakeExtractor } from './fake'
import { type Env, extractorMode } from './mode'
import type { Extractor } from './types'

export * from './types'
export { createClaudeExtractor, createFakeExtractor, extractorMode }
export type { ExtractorMode } from './mode'

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
