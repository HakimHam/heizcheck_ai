import { describe, expect, it } from 'vitest'
import { RULE_IDS } from '../check-engine'
import { loadKnowledge, parseKnowledge } from './knowledge'

const FILE = `# Fristen

Einleitung, die zu keinem Abschnitt gehört.

## B1 – Abrechnungsfrist

Die Frist endet 12 Monate nach dem Ende des Abrechnungszeitraums.

### Was tun

Rechtzeitig versenden.

## Versand nachweisen

Per Einwurf-Einschreiben.
`

describe('parseKnowledge', () => {
  it('splits a file into one section per ## heading, keeping ### subsections inside', () => {
    const sections = parseKnowledge('fristen.md', FILE)

    expect(sections.map((s) => s.heading)).toEqual(['B1 – Abrechnungsfrist', 'Versand nachweisen'])
    expect(sections[0]).toMatchObject({ file: 'fristen.md', ruleIds: ['B1'] })
    expect(sections[0].text).toContain('### Was tun')
    expect(sections[0].text).toContain('Rechtzeitig versenden.')
    expect(sections[0].text).not.toContain('Per Einwurf-Einschreiben')
  })

  it('drops the text before the first section', () => {
    const texts = parseKnowledge('fristen.md', FILE).map((s) => s.text).join('\n')
    expect(texts).not.toContain('Einleitung')
  })

  it('takes rule IDs from the heading only, as whole words', () => {
    const sections = parseKnowledge(
      'x.md',
      '## H4 und H5 – Geschätzte Werte\n\nSiehe auch B1.\n\n## Kein H40 hier\n\nText.\n',
    )
    expect(sections[0].ruleIds).toEqual(['H4', 'H5'])
    expect(sections[1].ruleIds).toEqual([])
  })

  it('reads a file with Windows line endings', () => {
    const sections = parseKnowledge('x.md', '## B1 – Frist\r\n\r\nText.\r\n')
    expect(sections).toHaveLength(1)
    expect(sections[0].heading).toBe('B1 – Frist')
  })
})

describe('the knowledge base in knowledge/', () => {
  it('explains every rule in the Check Report in exactly one section', async () => {
    const sections = await loadKnowledge()
    for (const rule of RULE_IDS) {
      expect(sections.filter((s) => s.ruleIds.includes(rule)).map((s) => s.heading), rule).toHaveLength(1)
    }
  })

  it('has at least 10 knowledge points, each with a heading and some text', async () => {
    const sections = await loadKnowledge()
    expect(sections.length).toBeGreaterThanOrEqual(10)
    for (const section of sections) expect(section.text.length, section.heading).toBeGreaterThan(100)
  })
})
