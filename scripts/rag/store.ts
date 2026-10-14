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

const key = (name: string) => {
  const message = `Missing ${name} — set it in .env.local`
  return z.string({ error: message }).min(1, message)
}

const configSchema = z.object({
  OPENAI_API_KEY: key('OPENAI_API_KEY'),
  PINECONE_API_KEY: key('PINECONE_API_KEY'),
  ANTHROPIC_API_KEY: key('ANTHROPIC_API_KEY'),
  RAG_PINECONE_INDEX: z.string().min(1).default('heizcheck-rag'),
  RAG_PINECONE_NAMESPACE: z
    .string()
    .min(1)
    .default('heizcheck-own-rag')
    .refine((ns) => ns !== SHARED_NAMESPACE, `The RAG must not use the shared namespace "${SHARED_NAMESPACE}"`),
})

/** Keys and the Pinecone index and namespace the RAG uses. */
export type RagConfig = {
  openaiApiKey: string
  pineconeApiKey: string
  anthropicApiKey: string
  index: string
  namespace: string
}

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
    anthropicApiKey: c.ANTHROPIC_API_KEY,
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

const indexSchema = z.object({ host: z.string().min(1), dimension: z.number().int() })

const embeddingsSchema = z.object({
  data: z.array(z.object({ index: z.number().int(), embedding: z.array(z.number()).length(EMBEDDING_DIMENSION) })),
})

/** The SDK clients the store talks to; tests pass doubles. */
export type StoreClients = { openai: OpenAI; pinecone: Pinecone }

/**
 * Reseeding and searching our namespace. Responses from Pinecone and OpenAI
 * are checked before use: a wrong index dimension or a missing embedding
 * stops the seed instead of storing broken vectors.
 */
export function vectorStore(
  config: RagConfig,
  { openai, pinecone }: StoreClients = {
    openai: new OpenAI({ apiKey: config.openaiApiKey }),
    pinecone: new Pinecone({ apiKey: config.pineconeApiKey }),
  },
) {
  /** Our index, after checking Pinecone's description of it. */
  async function openIndex() {
    const parsed = indexSchema.safeParse(await pinecone.describeIndex(config.index))
    if (!parsed.success) throw new Error(`Unexpected Pinecone index description: ${parsed.error.message}`)
    return { index: pinecone.index(config.index, parsed.data.host), dimension: parsed.data.dimension }
  }

  async function embed(texts: string[]): Promise<number[][]> {
    const parsed = embeddingsSchema.safeParse(await openai.embeddings.create({ model: EMBEDDING_MODEL, input: texts }))
    if (!parsed.success) throw new Error(`Unexpected OpenAI embedding response: ${parsed.error.message}`)
    if (parsed.data.data.length !== texts.length) {
      throw new Error(`OpenAI returned ${parsed.data.data.length} embeddings for ${texts.length} texts`)
    }
    return parsed.data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
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
      const { index, dimension } = await openIndex()
      if (dimension !== EMBEDDING_DIMENSION) {
        throw new Error(`Index "${config.index}" has ${dimension} dimensions; ${EMBEDDING_MODEL} needs ${EMBEDDING_DIMENSION}`)
      }
      const vectors = await embed(chunks.map((c) => c.embedText))
      const ns = index.namespace(config.namespace)
      // deleteAll fails on a namespace that doesn't exist yet, i.e. on the first seed.
      if ((await index.describeIndexStats()).namespaces?.[config.namespace]) await ns.deleteAll()
      await ns.upsert({ records: chunks.map((c, i) => ({ id: c.id, values: vectors[i], metadata: c.metadata })) })
    },

    /** The `topK` chunks closest to `question`, best first. */
    async search(question: string, topK: number): Promise<SearchHit[]> {
      const { index } = await openIndex()
      const [vector] = await embed([question])
      const result = await index.namespace(config.namespace).query({ vector, topK, includeMetadata: true })
      return (result.matches ?? []).map(parseMatch)
    },
  }
}
