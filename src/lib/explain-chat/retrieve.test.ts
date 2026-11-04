import { describe, expect, it } from 'vitest'
import type { KnowledgeSection } from './knowledge'
import { MIN_SCORE, retrieve, scoreSection, TOP_K, tokenize } from './retrieve'

const section = (heading: string, body: string, ruleIds: KnowledgeSection['ruleIds'] = []): KnowledgeSection => ({
  file: 'test.md',
  heading,
  ruleIds,
  text: `## ${heading}\n\n${body}`,
})

const B1 = section('B1 – Abrechnungsfrist', 'Die Abrechnungsfrist endet zwölf Monate nach dem Abrechnungszeitraum.', ['B1'])
const K1 = section('K1 – Aufteilung der CO₂-Kosten', 'Vermieter und Mieter teilen die CO₂-Kosten nach Stufe.', ['K1'])
const H5 = section('H5 – Geschätzte Werte', 'Geschätzte Ablesewerte werden genannt.', ['H5'])
const STATUS = section('Prüfergebnisse', 'Bestanden, Befund oder nicht prüfbar.')
const ALL = [B1, K1, H5, STATUS]

describe('tokenize', () => {
  it('lowercases, folds umlauts and ß, and drops stop words and short words', () => {
    expect(tokenize('Was ist die Größe der Fläche?')).toEqual(['groesse', 'flaeche'])
  })

  it('reads CO₂ with a subscript as co2', () => {
    expect(tokenize('CO₂-Kosten')).toEqual(['co2', 'kosten'])
  })

  it('maps a synonym to the word the knowledge base uses', () => {
    expect(tokenize('deadline')).toEqual(['frist'])
    expect(tokenize('Kohlendioxid')).toEqual(['co2'])
  })

  it('keeps each word once', () => {
    expect(tokenize('Frist Frist frist')).toEqual(['frist'])
  })
})

describe('scoreSection', () => {
  it('counts each question word found in the section once', () => {
    expect(scoreSection(['vermieter', 'mieter', 'stufe'], K1)).toBe(3)
  })

  it('finds a word inside a German compound', () => {
    // "frist" sits inside "abrechnungsfrist"
    expect(scoreSection(['frist'], B1)).toBe(1)
  })

  it('scores 0 when no word matches', () => {
    expect(scoreSection(['geschaeftsfuehrer'], B1)).toBe(0)
  })
})

describe('retrieve', () => {
  it('puts the section of the given rule first, even with no matching words', () => {
    const result = retrieve(ALL, { ruleId: 'H5', question: 'Hallo?' })
    expect(result.found).toBe(true)
    expect(result.sections[0]).toBe(H5)
  })

  it('pins a rule ID written in the question', () => {
    const result = retrieve(ALL, { question: 'Was prüft b1 genau?' })
    expect(result.sections[0]).toBe(B1)
  })

  it('adds the best scoring other sections after the pinned one', () => {
    const result = retrieve(ALL, { ruleId: 'B1', question: 'Wer trägt die CO2-Kosten, Vermieter oder Mieter?' })
    expect(result.sections).toEqual([B1, K1])
  })

  it(`returns at most ${TOP_K} sections, best first`, () => {
    const many = Array.from({ length: 6 }, (_, i) => section(`S${i}`, 'frist '.repeat(i) + 'text'))
    const result = retrieve(many, { question: 'Frist' })
    expect(result.sections).toHaveLength(TOP_K)
    expect(result.sections.map((s) => s.heading)).toEqual(['S1', 'S2', 'S3'])
  })

  it('ranks the section with more matching words higher', () => {
    const result = retrieve(ALL, { question: 'CO2 Stufe Mieter Frist' })
    expect(result.sections[0]).toBe(K1)
  })

  describe(`threshold: a best score below ${MIN_SCORE} without a rule ID means no context`, () => {
    it('0 matching words → not found', () => {
      expect(retrieve(ALL, { question: 'Wie heißt der Geschäftsführer?' })).toEqual({ found: false, sections: [] })
    })

    it('1 matching word → found', () => {
      const result = retrieve(ALL, { question: 'Geschäftsführer Frist' })
      expect(result).toEqual({ found: true, sections: [B1] })
    })

    it('2 matching words → found', () => {
      const result = retrieve(ALL, { question: 'Frist Abrechnungszeitraum' })
      expect(result.found).toBe(true)
      expect(result.sections[0]).toBe(B1)
    })

    it('the product name alone → not found, though it appears all over the knowledge base', () => {
      const withName = [...ALL, section('Was HeizCheck nicht tut', 'HeizCheck ist keine Rechtsberatung.')]
      expect(retrieve(withName, { question: 'Wer ist der Geschäftsführer von HeizCheck?' }).found).toBe(false)
    })

    it('a question of stop words only → not found', () => {
      expect(retrieve(ALL, { question: 'Was ist das?' }).found).toBe(false)
    })
  })
})
