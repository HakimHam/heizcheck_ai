// Helpers for `rag:ask --trace`, which prints every step of the chain.

import { questionSchema } from './chain'

/** How many numbers of the 1536-number question vector the trace prints. */
export const PREVIEW_NUMBERS = 5

/**
 * The question and whether to trace, from the command-line words; `null` if
 * no valid question is left.
 *
 * `parseAskArgs(['--trace', 'Wann', 'wird', 'gelöscht?'])` → `{question: 'Wann wird gelöscht?', trace: true}`
 */
export function parseAskArgs(argv: string[]): { question: string; trace: boolean } | null {
  const question = questionSchema.safeParse(argv.filter((a) => a !== '--trace').join(' '))
  return question.success ? { question: question.data, trace: argv.includes('--trace') } : null
}

/**
 * The start of a vector and its length, since all 1536 numbers would fill the screen.
 *
 * `vectorPreview([0.01234, -0.5, 0, 0.1, 0.2, 0.3])` → `'[0.0123, -0.5000, 0.0000, 0.1000, 0.2000, …] (6 Zahlen)'`
 */
export function vectorPreview(vector: number[]): string {
  const shown = vector.slice(0, PREVIEW_NUMBERS).map((n) => n.toFixed(4))
  if (vector.length > PREVIEW_NUMBERS) shown.push('…')
  return `[${shown.join(', ')}] (${vector.length} Zahlen)`
}
