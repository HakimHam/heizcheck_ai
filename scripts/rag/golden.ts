import { z } from 'zod'
import { questionSchema, type RagResult } from './chain'
import type { ChunkMetadata } from './chunks'

const expectedSource = z.object({ source_file: z.string().min(1), heading: z.string().min(1) })

const goldenEntrySchema = z.object({
  id: z.number().int().positive(),
  type: z.enum(['real', 'unanswerable', 'tricky', 'cross-language']),
  question: questionSchema,
  expect: z.union([
    z.object({ refuse: z.literal(true) }).strict(),
    z.object({ sources: z.array(expectedSource).min(1) }).strict(),
  ]),
})

const goldenSetSchema = z
  .array(goldenEntrySchema)
  .min(1)
  .refine((entries) => new Set(entries.map((e) => e.id)).size === entries.length, 'Golden set ids must be unique')

/**
 * One regression question: the chain must either cite every expected
 * `source_file` + `heading`, or refuse. Exact answer wording is checked by hand.
 */
export type GoldenEntry = z.infer<typeof goldenEntrySchema>

/** How one golden entry fared. `retrievedExpected` tells a retrieval miss apart from a generation miss. */
export type GoldenScore = { pass: boolean; retrievedExpected: boolean | null; detail: string }

/** Validates `scripts/rag/golden-set.json`; throws with the zod message if it is malformed. */
export function parseGoldenSet(data: unknown): GoldenEntry[] {
  const parsed = goldenSetSchema.safeParse(data)
  if (!parsed.success) throw new Error(`Invalid golden set: ${parsed.error.message}`)
  return parsed.data
}

/**
 * Scores the chain's result for one entry. An expected source counts as cited
 * when a cited chunk has the same `source_file` and `heading`.
 *
 * `scoreEntry({expect: {refuse: true}, …}, {kind: 'refusal', …})` → `{pass: true, …}`
 */
export function scoreEntry(entry: GoldenEntry, result: RagResult): GoldenScore {
  if ('refuse' in entry.expect) {
    return result.kind === 'refusal'
      ? { pass: true, retrievedExpected: null, detail: `refused (${result.reason})` }
      : { pass: false, retrievedExpected: null, detail: 'answered, but should have refused' }
  }

  const expected = entry.expect.sources
  const retrievedExpected = expected.every((e) => result.retrieved.some((h) => sameSection(h.metadata, e)))

  if (result.kind === 'refusal') {
    return { pass: false, retrievedExpected, detail: `refused (${result.reason}), but should have answered` }
  }
  const missing = expected.filter((e) => !result.sources.some((s) => sameSection(s, e)))
  return missing.length
    ? { pass: false, retrievedExpected, detail: `did not cite ${missing.map((m) => m.heading).join(', ')}` }
    : { pass: true, retrievedExpected, detail: 'cited every expected source' }
}

/** The part of a chunk's metadata a golden entry names: which PDF, and which section in it. */
type SectionRef = Pick<ChunkMetadata, 'source_file' | 'heading'>

function sameSection(a: SectionRef, b: SectionRef): boolean {
  return a.source_file === b.source_file && a.heading === b.heading
}
