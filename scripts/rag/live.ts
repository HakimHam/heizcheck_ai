// The chain's real dependencies: our Pinecone namespace and Claude via
// LangChain. Kept apart from chain.ts so the tests never need keys.

import { ChatAnthropic } from '@langchain/anthropic'
import { type AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { type RagDeps, TOP_K } from './chain'
import { ragConfig, vectorStore } from './store'

/**
 * The model that writes answers. Haiku is enough to answer from three short
 * chunks; the extractor's Sonnet reads whole statements. Switch to
 * `claude-sonnet-5` if the golden set shows Haiku missing answers the chunks hold.
 */
export const ANSWER_MODEL = 'claude-haiku-5-5'

/**
 * Search and generation wired to Pinecone, OpenAI and Claude, configured from
 * `env`. `onEmbedding` sees each question's vector, for `rag:ask --trace`.
 */
export function liveDeps(
  env: Record<string, string | undefined>,
  { onEmbedding }: { onEmbedding?: (vector: number[]) => void } = {},
): RagDeps {
  const config = ragConfig(env)
  const store = vectorStore(config)
  // No temperature: the API rejects it for this model ("`temperature` is deprecated").
  // Answers can therefore vary in wording between runs; the golden set scores
  // citations and refusals, not wording.
  const llm = new ChatAnthropic({ model: ANSWER_MODEL, apiKey: config.anthropicApiKey })

  return {
    search: (question) => store.search(question, TOP_K, onEmbedding),
    generate: async (system, user) => replyText((await llm.invoke([new SystemMessage(system), new HumanMessage(user)])).content),
  }
}

/**
 * The text of a chat reply. LangChain gives either a string or a list of
 * content parts (text, thinking, …); only the text parts make up the answer.
 *
 * `replyText([{type: 'text', text: '{"answerable": '}, {type: 'thinking', …}, {type: 'text', text: 'false}'}])`
 * → `'{"answerable": false}'`
 */
export function replyText(content: AIMessage['content']): string {
  if (typeof content === 'string') return content
  return content.map((part) => (part.type === 'text' && typeof part.text === 'string' ? part.text : '')).join('')
}
