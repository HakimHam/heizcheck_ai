import { describe, expect, it } from 'vitest'
import { appExtractor, createFakeExtractor, extractorMode } from '.'

const pdfs = [{ fileName: 'Gesamtabrechnung.pdf', bytes: new Uint8Array() }]

describe('the Extractor the app uses', () => {
  it('is the fake unless EXTRACTOR says otherwise', async () => {
    expect(extractorMode({})).toBe('fake')
    expect(await appExtractor({}).extract(pdfs)).toEqual(await createFakeExtractor().extract(pdfs))
    expect(await appExtractor({ EXTRACTOR: 'fake' }).extract(pdfs)).toEqual(await createFakeExtractor().extract(pdfs))
  })

  it('is Claude over the Anthropic API with EXTRACTOR=anthropic, outside production', () => {
    for (const VERCEL_ENV of [undefined, 'development', 'preview']) {
      const env = { EXTRACTOR: 'anthropic', VERCEL_ENV }
      expect(extractorMode(env)).toBe('anthropic')
      expect(appExtractor(env)).not.toBeUndefined()
    }
  })

  it('refuses the Anthropic API in production, where only Bedrock may be used (ADR 0003)', () => {
    expect(() => appExtractor({ EXTRACTOR: 'anthropic', VERCEL_ENV: 'production' })).toThrow(/production/)
  })

  it('has no Bedrock transport yet (ticket 17)', () => {
    expect(extractorMode({ EXTRACTOR: 'bedrock' })).toBe('bedrock')
    expect(() => appExtractor({ EXTRACTOR: 'bedrock' })).toThrow(/not implemented/)
  })

  it('rejects an unknown EXTRACTOR rather than guessing', () => {
    expect(() => extractorMode({ EXTRACTOR: 'claude' })).toThrow(/EXTRACTOR/)
    expect(() => appExtractor({ EXTRACTOR: 'claude' })).toThrow(/EXTRACTOR/)
  })
})
