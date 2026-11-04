import Anthropic from '@anthropic-ai/sdk'
import type { ExplainModel } from './explain'

/**
 * Claude Haiku 5.5 over the Anthropic API: fast and cheap, and enough to
 * answer from three short sections. Dev/demo only (ADR 0005), with the same
 * `ANTHROPIC_API_KEY` as the dev extraction transport. No temperature: Haiku
 * rejects it.
 */
export function anthropicExplainModel(): ExplainModel {
  let client: Anthropic | undefined
  return {
    model: 'claude-haiku-5-5',
    // The SDK retries twice by default; the 15 s abort in explainFinding bounds the total.
    send: (request, signal) => (client ??= new Anthropic()).messages.create(request, { signal }),
  }
}
