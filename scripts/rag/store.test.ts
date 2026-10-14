import { describe, expect, it } from 'vitest'
import { parseMatch, ragConfig } from './store'

const metadata = {
  source_file: 'heizcheck-handbuch.pdf',
  heading: 'HeizCheck Handbuch > Gebäude anlegen',
  chunk_id: 'heizcheck-handbuch#03',
  chunk_index: 3,
  page: 1,
  chunk_text: 'Legen Sie zuerst ein Gebäude an.',
}

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
    expect(ragConfig({ OPENAI_API_KEY: 'sk', PINECONE_API_KEY: 'pc' })).toMatchObject({
      index: 'heizcheck-rag',
      namespace: 'heizcheck-own-rag',
    })
  })

  it('refuses the shared workshop namespace', () => {
    expect(() =>
      ragConfig({ OPENAI_API_KEY: 'sk', PINECONE_API_KEY: 'pc', RAG_PINECONE_NAMESPACE: 'workshop-shared' }),
    ).toThrow(/workshop-shared/)
  })

  it('names the missing key', () => {
    expect(() => ragConfig({ PINECONE_API_KEY: 'pc' })).toThrow(/OPENAI_API_KEY/)
  })
})
