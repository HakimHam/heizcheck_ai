import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { RULE_IDS, type RuleId } from '../check-engine'

/**
 * One `##` section of the knowledge base: the unit the explain chat retrieves
 * and cites, e.g. `abrechnungsfrist.md › B1 – Abrechnungsfrist`.
 */
export type KnowledgeSection = {
  file: string
  /** The `##` heading without the hashes. */
  heading: string
  /** Rules named in the heading, so a Finding's "Erklären" button finds its section without search. */
  ruleIds: RuleId[]
  /** The heading line and everything up to the next `##`. */
  text: string
}

/** Where the German markdown knowledge base lives, relative to the app root. */
export const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge')

/**
 * Splits one markdown file into `##` sections. Text before the first `##`
 * (the `#` title and intro) is dropped: it is about the file, not an answer.
 */
export function parseKnowledge(file: string, markdown: string): KnowledgeSection[] {
  const sections: KnowledgeSection[] = []
  let current: { heading: string; lines: string[] } | null = null
  const flush = () => {
    if (current) sections.push(toSection(file, current.heading, current.lines))
  }
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^## (.+)$/.exec(line)
    if (heading) {
      flush()
      current = { heading: heading[1].trim(), lines: [line] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  flush()
  return sections
}

function toSection(file: string, heading: string, lines: string[]): KnowledgeSection {
  const words = new Set(heading.split(/[^A-Za-z0-9]+/))
  return {
    file,
    heading,
    ruleIds: RULE_IDS.filter((rule) => words.has(rule)),
    text: lines.join('\n').trim(),
  }
}

/** Reads every `.md` file in the knowledge base, in file name order. */
export async function loadKnowledge(dir: string = KNOWLEDGE_DIR): Promise<KnowledgeSection[]> {
  const files = (await readdir(dir)).filter((name) => name.endsWith('.md')).sort()
  const parsed = await Promise.all(files.map(async (file) => parseKnowledge(file, await readFile(path.join(dir, file), 'utf8'))))
  return parsed.flat()
}
