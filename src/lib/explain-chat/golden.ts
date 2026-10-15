import { z } from 'zod'
import { RULE_IDS } from '../check-engine'
import type { ExplainResult } from './explain'

const expectSchema = z.union([
  z.object({ headings: z.array(z.string()).min(1) }),
  z.object({ refuse: z.literal(true) }),
])

const goldenSchema = z.array(
  z.object({
    id: z.number(),
    /** Why the question is in the set: button, free, tricky, cross-language, unanswerable, injection … */
    type: z.string(),
    ruleId: z.enum(RULE_IDS).optional(),
    question: z.string(),
    expect: expectSchema,
  }),
)

/** One golden question: what the user asks and what a good result looks like. */
export type GoldenQuestion = z.infer<typeof goldenSchema>[number]

/** Reads `eval/explain-chat/golden-set.json`; a malformed file throws instead of grading nonsense. */
export function parseGoldenSet(json: unknown): GoldenQuestion[] {
  return goldenSchema.parse(json)
}

/**
 * Whether the explain chat handled a golden question well: an expected answer
 * cites every listed section, an expected refusal is one of the fallbacks.
 * A failed call never passes.
 */
export function grade(expected: GoldenQuestion['expect'], result: ExplainResult): boolean {
  if (result.status !== 200) return false
  const { outcome, sources } = result.answer
  if ('refuse' in expected) return outcome !== 'answered'
  const cited = new Set(sources.map((source) => source.heading))
  return outcome === 'answered' && expected.headings.every((heading) => cited.has(heading))
}
