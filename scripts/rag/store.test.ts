import type { Pinecone } from '@pinecone-database/pinecone'
import type OpenAI from 'openai'
import { describe, expect, it, vi } from 'vitest'
import type { Chunk } from './chunks'
import { EMBEDDING_DIMENSION, parseMatch, ragConfig, vectorStore } from './store'

const metadata = {
  source_file: 'heizcheck-handbuch.pdf',
  heading: 'HeizCheck Handbuch > Gebäude anlegen',
  chunk_id: 'heizcheck-handbuch#03',
  chunk_index: 3,
  page: 1,
  chunk_text: 'Legen Sie zuerst ein Gebäude an.',
}

const keys = { OPENAI_API_KEY: 'sk', PINECONE_API_KEY: 'pc', ANTHROPIC_API_KEY: 'ant' }

describe('parseMatch', () => {
  it('turns a Pinecone match into a search hit', () => {
    expect(parseMatch({ id: 'heizcheck-handbuch#03', score: 0.62, metadata })).toEqual({ score: 0.62, metadata })
  })

  it.each([
    ['no score', { id: 'x', metadata }],
    ['no metadata', { id: 'x', score: 0.5 }],
    ['metadata from another corpus', { id: 'x', score: 0.5, metadata: { chunk_text: 'Hi', section: 'PTO', page: 2 } }],
  ])('rejects a match with %s', (_, match) => {
    expect(() => parseMatch(match)).toThrow()
  })
})

describe('ragConfig', () => {
  it('uses the own heizcheck-rag index and namespace by default', () => {
    expect(ragConfig(keys)).toMatchObject({ index: 'heizcheck-rag', namespace: 'heizcheck-own-rag', anthropicApiKey: 'ant' })
  })

  it('refuses the shared workshop namespace', () => {
    expect(() => ragConfig({ ...keys, RAG_PINECONE_NAMESPACE: 'workshop-shared' })).toThrow(/workshop-shared/)
  })

  it.each(['OPENAI_API_KEY', 'PINECONE_API_KEY', 'ANTHROPIC_API_KEY'])('names a missing %s', (key) => {
    expect(() => ragConfig({ ...keys, [key]: undefined })).toThrow(new RegExp(key))
  })
})

const chunk = (n: number): Chunk => ({
  id: `heizcheck-handbuch#0${n}`,
  embedText: `Text ${n}`,
  metadata: { ...metadata, chunk_id: `heizcheck-handbuch#0${n}`, chunk_index: n },
})
const vector = (length = EMBEDDING_DIMENSION) => Array.from({ length }, () => 0.1)

/** Fake OpenAI and Pinecone clients; only the calls vectorStore makes. */
function fakeClients({
  indexes = ['heizcheck-rag'],
  dimension = EMBEDDING_DIMENSION,
  namespaces = ['heizcheck-own-rag'],
  embeddings = (input: string[]) => input.map((_, index) => ({ index, embedding: vector() })),
  matches = [] as unknown[],
} = {}) {
  const ns = {
    deleteAll: vi.fn(async () => {}),
    upsert: vi.fn(async () => {}),
    query: vi.fn(async () => ({ matches })),
  }
  const pinecone = {
    listIndexes: vi.fn(async () => ({ indexes: indexes.map((name) => ({ name })) })),
    createIndex: vi.fn(async () => {}),
    describeIndex: vi.fn(async () => ({ host: 'host.pinecone.io', dimension })),
    index: vi.fn(() => ({
      namespace: () => ns,
      describeIndexStats: async () => ({ namespaces: Object.fromEntries(namespaces.map((n) => [n, { recordCount: 1 }])) }),
    })),
  }
  const openai = {
    embeddings: { create: vi.fn(async ({ input }: { input: string[] }) => ({ data: embeddings(input) })) },
  }
  return {
    ns,
    pinecone,
    openai,
    store: vectorStore(ragConfig(keys), {
      // Test doubles for the SDK clients; only the methods above are called.
      pinecone: pinecone as unknown as Pinecone,
      openai: openai as unknown as OpenAI,
    }),
  }
}

describe('vectorStore', () => {
  it('creates the index on the first seed', async () => {
    const f = fakeClients({ indexes: [] })

    await f.store.reseed([chunk(1)])

    expect(f.pinecone.createIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'heizcheck-rag',
        dimension: 1536,
        metric: 'cosine',
        spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
      }),
    )
  })

  it('does not create an index that exists', async () => {
    const f = fakeClients()

    await f.store.reseed([chunk(1)])

    expect(f.pinecone.createIndex).not.toHaveBeenCalled()
  })

  it.each([
    { dimension: 1535, ok: false },
    { dimension: 1536, ok: true },
    { dimension: 1537, ok: false },
  ])('with an index of $dimension dimensions, seeds: $ok', async ({ dimension, ok }) => {
    const f = fakeClients({ dimension })

    const seeding = f.store.reseed([chunk(1)])

    if (ok) await expect(seeding).resolves.toBeUndefined()
    else await expect(seeding).rejects.toThrow(/dimensions/)
    expect(f.ns.upsert).toHaveBeenCalledTimes(ok ? 1 : 0)
  })

  it('clears an existing namespace before upserting, so nothing stale is left', async () => {
    const f = fakeClients()

    await f.store.reseed([chunk(1), chunk(2)])

    expect(f.ns.deleteAll).toHaveBeenCalledTimes(1)
    expect(f.ns.upsert).toHaveBeenCalledWith({
      records: [
        { id: 'heizcheck-handbuch#01', values: vector(), metadata: chunk(1).metadata },
        { id: 'heizcheck-handbuch#02', values: vector(), metadata: chunk(2).metadata },
      ],
    })
  })

  it('does not clear a namespace that does not exist yet', async () => {
    const f = fakeClients({ namespaces: [] })

    await f.store.reseed([chunk(1)])

    expect(f.ns.deleteAll).not.toHaveBeenCalled()
  })

  it.each([
    ['fewer embeddings than chunks', () => [{ index: 0, embedding: vector() }]],
    ['an embedding of the wrong length', (input: string[]) => input.map((_, index) => ({ index, embedding: vector(3) }))],
  ])('refuses %s from OpenAI', async (_, embeddings) => {
    const f = fakeClients({ embeddings })

    await expect(f.store.reseed([chunk(1), chunk(2)])).rejects.toThrow(/embedding/i)
    expect(f.ns.upsert).not.toHaveBeenCalled()
  })

  it('searches with the embedded question and returns checked hits', async () => {
    const f = fakeClients({ matches: [{ id: 'heizcheck-handbuch#03', score: 0.7, metadata }] })

    const hits = await f.store.search('Wie lege ich ein Gebäude an?', 3)

    expect(hits).toEqual([{ score: 0.7, metadata }])
    expect(f.ns.query).toHaveBeenCalledWith({ vector: vector(), topK: 3, includeMetadata: true })
  })

  it('hands the question vector to onEmbedding before querying', async () => {
    const f = fakeClients()
    const onEmbedding = vi.fn()

    await f.store.search('Wie lege ich ein Gebäude an?', 3, onEmbedding)

    expect(onEmbedding).toHaveBeenCalledWith(vector())
  })
})
