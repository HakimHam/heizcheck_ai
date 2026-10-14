// The vector store: OpenAI embeddings in our own Pinecone namespace. Embeddings
// come from OpenAI because Anthropic offers no embedding model.

import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'
import { z } from 'zod'
import type { SearchHit } from './chain'
import type { Chunk } from './chunks'

/** The embedding model; its vectors have {@link EMBEDDING_DIMENSION} dimensions. */
export const EMBEDDING_MODEL = 'text-embedding-3-small'
/** Must match the Pinecone index, or seeding refuses to run. */
export const EMBEDDING_DIMENSION = 1536
/** The workshop's shared namespace, which this RAG must never write to. */
const SHARED_NAMESPACE = 'workshop-shared'

const configSchema = z.object({
  OPENAI_API_KEY: z.string({ error: 'Missing OPENAI_API_KEY — set it in .env.local' }).min(1),
  PINECONE_API_KEY: z.string({ error: 'Missing PINECONE_API_KEY — set it in .env.local' }).min(1),
  RAG_PINECONE_INDEX: z.string().min(1).default('heizcheck-rag'),
  RAG_PINECONE_NAMESPACE: z
    .string()
    .min(1)
    .default('heizcheck-own-rag')
    .refine((ns) => ns !== SHARED_NAMESPACE, `The RAG must not use the shared namespace "${SHARED_NAMESPACE}"`),
})

/** Keys and the Pinecone index and namespace the RAG uses. */
export type RagConfig = { openaiApiKey: string; pineconeApiKey: string; index: string; namespace: string }

/**
 * Reads the RAG's settings from the environment, defaulting to the
 * `heizcheck-own-rag` namespace in our own `heizcheck-rag` index.
 *
 * `ragConfig(process.env)` → `{index: 'heizcheck-rag', namespace: 'heizcheck-own-rag', …}`
 */
export function ragConfig(env: Record<string, string | undefined>): RagConfig {
  const parsed = configSchema.safeParse(env)
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '))
  const c = parsed.data
  return {
    openaiApiKey: c.OPENAI_API_KEY,
    pineconeApiKey: c.PINECONE_API_KEY,
    index: c.RAG_PINECONE_INDEX,
    namespace: c.RAG_PINECONE_NAMESPACE,
  }
}

const matchSchema = z.object({
  score: z.number(),
  metadata: z.object({
    source_file: z.string(),
    heading: z.string(),
    chunk_id: z.string(),
    chunk_index: z.number().int(),
    page: z.number().int(),
    chunk_text: z.string(),
  }),
})

/** Checks one Pinecone query match and turns it into a {@link SearchHit}; throws if its metadata isn't ours. */
export function parseMatch(match: unknown): SearchHit {
  const parsed = matchSchema.safeParse(match)
  if (!parsed.success) throw new Error(`Unexpected Pinecone match: ${parsed.error.message}`)
  return parsed.data
}

/** The OpenAI and Pinecone clients for one config, with the operations the RAG needs. */
export function vectorStore(config: RagConfig) {
  const openai = new OpenAI({ apiKey: config.openaiApiKey })
  const pinecone = new Pinecone({ apiKey: config.pineconeApiKey })

  async function namespace() {
    const description = await pinecone.describeIndex(config.index)
    return { ns: pinecone.index(config.index, description.host).namespace(config.namespace), description }
  }

  async function embed(texts: string[]): Promise<number[][]> {
    const response = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: texts })
    return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
  }

  return {
    /** Replaces everything in the namespace with `chunks`, creating the index on the first seed. */
    async reseed(chunks: Chunk[]): Promise<void> {
      const existing = (await pinecone.listIndexes()).indexes ?? []
      if (!existing.some((i) => i.name === config.index)) {
        // aws us-east-1 is the region Pinecone's free plan allows.
        await pinecone.createIndex({
          name: config.index,
          dimension: EMBEDDING_DIMENSION,
          metric: 'cosine',
          spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
          waitUntilReady: true,
        })
      }
      const { ns, description } = await namespace()
      if (description.dimension !== EMBEDDING_DIMENSION) {
        throw new Error(
          `Index "${config.index}" has ${description.dimension} dimensions; ${EMBEDDING_MODEL} needs ${EMBEDDING_DIMENSION}`,
        )
      }
      const vectors = await embed(chunks.map((c) => c.embedText))
      // deleteAll fails on a namespace that doesn't exist yet, i.e. on the first seed.
      const stats = await pinecone.index(config.index, description.host).describeIndexStats()
      if (stats.namespaces?.[config.namespace]) await ns.deleteAll()
      await ns.upsert({ records: chunks.map((c, i) => ({ id: c.id, values: vectors[i], metadata: c.metadata })) })
    },

    /** The `topK` chunks closest to `question`, best first. */
    async search(question: string, topK: number): Promise<SearchHit[]> {
      const { ns } = await namespace()
      const [vector] = await embed([question])
      const result = await ns.query({ vector, topK, includeMetadata: true })
      return (result.matches ?? []).map(parseMatch)
    },
  }
}
