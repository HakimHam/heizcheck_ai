// The chain's real dependencies: our Pinecone namespace and Claude via
// LangChain. Kept apart from chain.ts so the tests never need keys.

import { ChatAnthropic } from '@langchain/anthropic'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { type RagDeps, TOP_K } from './chain'
import { ragConfig, vectorStore } from './store'

/**
 * The model that writes answers. Haiku is enough to answer from three short
 * chunks; the extractor's Sonnet reads whole statements. Switch to
 * `claude-sonnet-5` if the golden set shows Haiku missing answers the chunks hold.
 */
export const ANSWER_MODEL = 'claude-haiku-5-5'

/** Search and generation wired to Pinecone, OpenAI and Claude, configured from `env`. */
export function liveDeps(env: Record<string, string | undefined>): RagDeps {
  if (!env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY — set it in .env.local')
  const store = vectorStore(ragConfig(env))
  const llm = new ChatAnthropic({ model: ANSWER_MODEL, temperature: 0, apiKey: env.ANTHROPIC_API_KEY })

  return {
    search: (question) => store.search(question, TOP_K),
    async generate(system, user) {
      const response = await llm.invoke([new SystemMessage(system), new HumanMessage(user)])
      return typeof response.content === 'string'
        ? response.content
        : response.content.map((part) => ('text' in part && typeof part.text === 'string' ? part.text : '')).join('')
    },
  }
}
