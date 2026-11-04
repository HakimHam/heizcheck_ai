import Anthropic from '@anthropic-ai/sdk'
import type { ClaudeTransport } from './claude'

/**
 * Claude Sonnet 5 over the Anthropic API. For development and the eval only,
 * with synthetic or anonymised PDFs: the Anthropic API doesn't keep data in
 * the EU (ADR 0003). The key comes from `ANTHROPIC_API_KEY`.
 */
export function anthropicTransport(): ClaudeTransport {
  let client: Anthropic | undefined
  return {
    model: 'claude-sonnet-5',
    // Streamed, so a long extraction doesn't hit the HTTP timeout.
    send: (request) => (client ??= new Anthropic()).messages.stream(request).finalMessage(),
  }
}
