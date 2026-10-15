// Naive retrieval for the explain chat (ADR 0005): keyword overlap over a
// small German knowledge base, no embeddings and no database.
import { RULE_IDS, type RuleId } from '../check-engine'
import type { KnowledgeSection } from './knowledge'

/** How many sections go into the prompt: enough for a rule plus its context, small enough for Haiku. */
export const TOP_K = 3

/** Without a rule ID, a question needs at least this many matching words to count as on-topic. */
export const MIN_SCORE = 1

/** Words shorter than this carry no meaning on their own ("im", "zu") and would match everywhere. */
const MIN_WORD_LENGTH = 3

// Written after folding (ä → ae, ß → ss), as tokenize compares them.
const STOP_WORDS = new Set(
  (
    'der die das den dem des ein eine einen einem einer eines und oder aber ist sind war waren sein bin ' +
    'was wie wo wann warum wer wen wem welche welcher welches wieso weshalb wozu heisst ' +
    'ich mir mich mein meine meinen meinem wir uns unser unsere sie ihr ihre ihnen ihm ihn sich man ' +
    'mit von fuer auf aus bei nach vor zum zur ueber unter durch ohne gegen um als wenn dann dass denn ' +
    'nicht kein keine keinen auch noch nur schon sehr mehr genau dieser diese dieses diesem diesen hier da ' +
    'muss muessen kann koennen darf duerfen soll sollen will wird werden wurde hat haben hatte gibt ' +
    'bitte danke hallo erklaeren erklaere bedeutet ' +
    // The product name is all over the knowledge base, so it says nothing about the topic.
    'heizcheck ' +
    'the and what why how when who does this that for with'
  ).split(' '),
)

/**
 * Words a Property Manager may type, mapped to the word the knowledge base
 * uses. Naive search only matches letters, so this covers its main weakness:
 * English and everyday words for the same thing.
 */
const SYNONYMS: Record<string, string> = {
  deadline: 'frist',
  spaet: 'frist',
  verspaetet: 'frist',
  kohlendioxid: 'co2',
  carbon: 'co2',
  tenant: 'mieter',
  tenants: 'mieter',
  landlord: 'vermieter',
  estimate: 'schaetz',
  estimated: 'schaetz',
  geschaetzt: 'schaetz',
  schaetzung: 'schaetz',
  area: 'flaeche',
  repair: 'reparatur',
  maintenance: 'wartung',
  cost: 'kosten',
  costs: 'kosten',
  split: 'aufteilung',
  water: 'warmwasser',
}

/** `Größe der CO₂-Fläche` → `groesse der co2 flaeche`, so umlauts and the subscript don't block a match. */
const fold = (text: string) =>
  text
    .toLocaleLowerCase('de-DE')
    .replace(/₂/g, '2')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')

const words = (text: string) => fold(text).split(/[^a-z0-9]+/).filter((word) => word.length >= MIN_WORD_LENGTH)

/**
 * The words of a question that are worth searching for, each once.
 * `Was ist die Größe der Fläche?` → `['groesse', 'flaeche']`
 */
export function tokenize(question: string): string[] {
  const tokens = words(question)
    .filter((word) => !STOP_WORDS.has(word))
    .map((word) => SYNONYMS[word] ?? word)
  return [...new Set(tokens)]
}

/**
 * How many of the question's words appear in the section. A word also counts
 * inside a longer word, because German glues nouns together: `frist` is found
 * in `abrechnungsfrist`.
 */
export function scoreSection(tokens: string[], section: KnowledgeSection): number {
  const sectionWords = words(section.text)
  return tokens.filter((token) => sectionWords.some((word) => word.includes(token))).length
}

/** What retrieval found: up to TOP_K sections, or nothing on-topic. */
export type Retrieval = { found: true; sections: KnowledgeSection[] } | { found: false; sections: [] }

/**
 * Finds the sections to answer from. The rule the user clicked, or a rule ID
 * written in the question, is pinned first: that lookup cannot miss. The
 * other places go to the best scoring sections. With nothing pinned and no
 * section reaching MIN_SCORE, the question is off-topic.
 */
export function retrieve(sections: KnowledgeSection[], query: { ruleId?: RuleId; question: string }): Retrieval {
  const rules = new Set<RuleId>(query.ruleId ? [query.ruleId] : [])
  for (const word of query.question.toUpperCase().split(/[^A-Z0-9]+/)) {
    if ((RULE_IDS as readonly string[]).includes(word)) rules.add(word as RuleId)
  }
  const pinned = sections.filter((section) => section.ruleIds.some((rule) => rules.has(rule)))

  const tokens = tokenize(query.question)
  const scored = sections
    .filter((section) => !pinned.includes(section))
    .map((section) => ({ section, score: scoreSection(tokens, section) }))
    .filter(({ score }) => score >= MIN_SCORE)
    // Array.sort is stable, so ties keep the knowledge base's order.
    .sort((a, b) => b.score - a.score)
    .map(({ section }) => section)

  const found = [...pinned, ...scored].slice(0, TOP_K)
  return found.length === 0 ? { found: false, sections: [] } : { found: true, sections: found }
}
