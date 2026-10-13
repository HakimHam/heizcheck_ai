import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { HELP_CATEGORIES, MAX_HELP_SUMMARY_LENGTH } from './help-chat'

// The n8n workflow can't import TypeScript, so this test keeps the committed
// workflow in step with the code that reads its answer.
const workflow = z
  .object({ nodes: z.array(z.object({ name: z.string(), parameters: z.record(z.string(), z.unknown()), onError: z.string().optional() })) })
  .parse(JSON.parse(readFileSync(new URL('../../n8n/hilfe-klassifizierung.workflow.json', import.meta.url), 'utf-8')))

const node = (name: string) => {
  const found = workflow.nodes.find((n) => n.name === name)
  if (!found) throw new Error(`The workflow has no node "${name}".`)
  return found
}

const outputSchema = z
  .object({
    properties: z.object({
      category: z.object({ enum: z.array(z.string()) }),
      summary: z.object({ maxLength: z.number() }),
    }),
  })
  .parse(JSON.parse(String(node('Antwortformat').parameters.inputSchema)))

const assignments = z
  .object({ assignments: z.array(z.object({ name: z.string(), value: z.string() })) })
  .parse(node('Kategorie festlegen').parameters.assignments).assignments

/** Runs one of the Set node's `={{ … }}` expressions against the AI step's output. */
const evaluate = (field: string, json: unknown): unknown => {
  const expression = assignments.find((a) => a.name === field)?.value ?? ''
  const body = /^=\{\{(.*)\}\}$/s.exec(expression)?.[1]
  if (!body) throw new Error(`"${field}" is not an n8n expression: ${expression}`)
  return new Function('$json', `return (${body})`)(json)
}

describe('the n8n workflow', () => {
  it('asks the model for exactly the categories HeizCheck can show', () => {
    expect(outputSchema.properties.category.enum).toEqual([...HELP_CATEGORIES])
  })

  it('asks for a summary no longer than HeizCheck accepts', () => {
    expect(outputSchema.properties.summary.maxLength).toBe(MAX_HELP_SUMMARY_LENGTH)
  })

  describe('the confidence cut-off', () => {
    // Below 0.6 the model is guessing; a person sorts the message instead.
    it.each([
      [0.59, 'sonstiges'],
      [0.6, 'datenschutz'],
      [0.61, 'datenschutz'],
    ])('at %s files a datenschutz message as %s', (confidence, expected) => {
      expect(evaluate('category', { output: { category: 'datenschutz', confidence, summary: 'x' } })).toBe(expected)
    })
  })

  describe('when the AI step fails', () => {
    it('carries on, so the message is still saved and HeizCheck still gets an answer', () => {
      expect(node('KI-Klassifizierung').onError).toBe('continueRegularOutput')
    })

    it('files the message as sonstiges with no summary', () => {
      const failed = { error: 'Model output does not match the schema' }
      expect(evaluate('category', failed)).toBe('sonstiges')
      expect(evaluate('confidence', failed)).toBe(0)
      expect(evaluate('summary', failed)).toBe('')
    })
  })
})
