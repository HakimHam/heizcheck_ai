import type Anthropic from '@anthropic-ai/sdk'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Figures } from '../figures'
import { createClaudeExtractor, type ClaudeTransport } from './claude'
import { testPdf } from './test-pdf'
import { ExtractionFailed, type StatementPdf } from './types'

const BUILDING = 'Gesamtabrechnung 2025.pdf'
const UNITS = 'Einzelabrechnungen.pdf'

let pdfs: StatementPdf[]
beforeAll(async () => {
  pdfs = [
    {
      fileName: BUILDING,
      bytes: await testPdf([
        ['Abrechnungszeitraum 01.01.2025 - 31.12.2025', 'Brennstoffkosten Erdgas 8.423,10 €', 'Gesamtkosten 9.500,00 €'],
        ['CO2-Kosten 993,80 €'],
      ]),
    },
    { fileName: UNITS, bytes: await testPdf([['WE 01', 'Ihr Anteil 1.512,38 €'], ['WE 02']]) },
  ]
})

const at = (file: string, page: number, quote: string) => ({ file, page, quote })

/** What a well-behaved model sends back through the tool. */
const toolInput = () => ({
  buildingFigures: [
    { figure: 'billingPeriod', value: '2025-01-01/2025-12-31', ...at(BUILDING, 1, '01.01.2025 - 31.12.2025') },
    { figure: 'totalCost', value: '9500.00', ...at(BUILDING, 1, '9.500,00 €') },
    { figure: 'heatingConsumptionSharePct', value: '70', ...at(BUILDING, 1, 'Verbrauchsanteil Heizung 70 %') },
    { figure: 'allocationMethod', value: 'consumption_split', ...at(BUILDING, 1, '70 % nach Verbrauch') },
    { figure: 'totalAreaM2', value: '430.8', ...at(BUILDING, 1, '430,8 m²') },
    { figure: 'areaDecimals', value: '1', ...at(BUILDING, 1, '430,8 m²') },
    { figure: 'fuelType', value: 'Erdgas', ...at(BUILDING, 1, 'Erdgas') },
    { figure: 'fuelQuantity', value: '98400', ...at(BUILDING, 1, '98.400 kWh') },
    { figure: 'fuelUnit', value: 'kWh', ...at(BUILDING, 1, '98.400 kWh') },
    { figure: 'co2Cost', value: '993.80', ...at(BUILDING, 2, '993,80 €') },
    { figure: 'co2Tier', value: '8', ...at(BUILDING, 2, 'Stufe 8') },
    { figure: 'co2LandlordSharePct', value: '70', ...at(BUILDING, 2, 'Vermieter 70 %') },
    { figure: 'co2TenantSharePct', value: '30', ...at(BUILDING, 2, 'Mieter 30 %') },
    { figure: 'co2Reduction', value: 'none', ...at(BUILDING, 2, 'keine Minderung') },
  ],
  costItems: <{ name: string; amount?: string; file: string; page: number; quote: string }[]>[
    { name: 'Brennstoffkosten  Erdgas', amount: '8423.10', ...at(BUILDING, 1, 'Brennstoffkosten Erdgas 8.423,10 €') },
    { name: 'Wartung', ...at(BUILDING, 1, 'Wartung') },
  ],
  units: [
    {
      unitId: 'WE 01',
      ...at(UNITS, 1, 'WE 01'),
      figures: [
        { figure: 'amount', value: '1512.38', ...at(UNITS, 1, '1.512,38 €') },
        { figure: 'areaM2', value: '68.4', ...at(UNITS, 1, '68,4 m²') },
        { figure: 'estimated', value: 'true', ...at(UNITS, 1, 'geschätzt') },
        { figure: 'billingPeriod', value: '2025-01-01/2025-12-31', ...at(UNITS, 1, '01.01.2025 - 31.12.2025') },
      ],
    },
    { unitId: 'WE 02', ...at(UNITS, 2, 'WE 02'), figures: [{ figure: 'consumption', value: '8103', ...at(UNITS, 2, '8.103') }] },
  ],
})

function message(content: unknown[], stop_reason = 'tool_use'): Anthropic.Message {
  return { id: 'msg', type: 'message', role: 'assistant', model: 'm', content, stop_reason, stop_details: null, usage: {} } as unknown as Anthropic.Message
}

const toolUse = (input: unknown) => ({ type: 'tool_use', id: 'tu', name: 'record_statement_figures', input })

/** A transport answering every request with the given message, keeping the requests. */
function transport(answer: Anthropic.Message | (() => Promise<Anthropic.Message>)) {
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = []
  const t: ClaudeTransport = {
    model: 'claude-sonnet-5',
    async send(request) {
      requests.push(request)
      return typeof answer === 'function' ? answer() : answer
    },
  }
  return { transport: t, requests }
}

const extractWith = (input: unknown) =>
  createClaudeExtractor({ transport: transport(message([toolUse(input)])).transport }).extract(pdfs)

describe('the Claude Extractor', () => {
  it('reads the tool input into Figures, leaving every figure not reported null', async () => {
    const { figures } = await extractWith(toolInput())
    expect(figures).toEqual<Figures>({
      building: {
        billingPeriod: { start: '2025-01-01', end: '2025-12-31' },
        // Names exactly as written, even with odd spacing; an amount not reported is null.
        costItems: [
          { name: 'Brennstoffkosten  Erdgas', amountCents: 842_310 },
          { name: 'Wartung', amountCents: null },
        ],
        totalCostCents: 950_000,
        heatingConsumptionSharePct: 70,
        hotWaterConsumptionSharePct: null,
        allocationMethod: 'consumption_split',
        totalAreaM2: 430.8,
        areaDecimals: 1,
        fuel: { type: 'Erdgas', quantity: 98_400, unit: 'kWh' },
        co2: {
          totalKg: null,
          statedKgPerM2Year: null,
          statedTier: 8,
          statedSplit: { landlordPct: 70, tenantPct: 30 },
          costCents: 99_380,
          statedReduction: 'none',
        },
      },
      units: [
        { unitId: 'WE 01', billingPeriod: { start: '2025-01-01', end: '2025-12-31' }, areaM2: 68.4, consumption: null, amountCents: 151_238, estimated: true },
        { unitId: 'WE 02', billingPeriod: null, areaM2: null, consumption: 8103, amountCents: null, estimated: null },
      ],
    })
  })

  it('leaves the fuel and the CO₂ split null unless the statement gives their essential parts', async () => {
    const input = toolInput()
    input.buildingFigures = input.buildingFigures.filter(
      (f) => !['fuelType', 'co2TenantSharePct'].includes(f.figure),
    )
    const { figures } = await extractWith(input)
    expect(figures.building.fuel).toBeNull()
    expect(figures.building.co2.statedSplit).toBeNull()
  })

  it('converts amounts to cents exactly', async () => {
    const input = toolInput()
    input.buildingFigures[1].value = '0.29'
    input.costItems[0].amount = '-12.5'
    const { figures } = await extractWith(input)
    expect(figures.building.totalCostCents).toBe(29)
    expect(figures.building.costItems[0].amountCents).toBe(-1250)
  })

  it('gives every figure a source with its file, page and quote, boxed where the quote is found', async () => {
    const { sources } = await extractWith(toolInput())
    expect(sources['building.totalCostCents']).toMatchObject({ file: BUILDING, page: 1, quote: '9.500,00 €' })
    expect(sources['building.totalCostCents'].bbox).toHaveLength(4)
    expect(sources['building.costItems.0'].bbox).toHaveLength(4)
    expect(sources['building.co2.costCents']).toMatchObject({ file: BUILDING, page: 2 })
    expect(sources['building.co2.costCents'].bbox).toBeDefined()
    expect(sources['units.0.amountCents'].bbox).toBeDefined()
    expect(sources['units.1.unitId']).toMatchObject({ file: UNITS, page: 2, quote: 'WE 02' })

    // Not on the page as quoted: the reference keeps its page, without a box.
    expect(sources['building.co2.statedTier']).toEqual({ file: BUILDING, page: 2, quote: 'Stufe 8' })
    // Figures read together share one source.
    expect(sources['building.fuel']).toMatchObject({ quote: 'Erdgas' })
    expect(sources['building.co2.statedSplit']).toMatchObject({ quote: 'Vermieter 70 %' })
    // A figure not found has no source.
    expect(sources['building.hotWaterConsumptionSharePct']).toBeUndefined()
  })

  it('sends all PDFs in one request, each labelled with its file name, through one strict tool', async () => {
    const { transport: t, requests } = transport(message([toolUse(toolInput())]))
    await createClaudeExtractor({ transport: t }).extract(pdfs)

    expect(requests).toHaveLength(1)
    const [request] = requests
    expect(request.model).toBe('claude-sonnet-5')
    expect(request.tool_choice).toEqual({ type: 'auto' })
    expect(request.tools).toHaveLength(1)
    expect(request.tools![0]).toMatchObject({ name: 'record_statement_figures', strict: true })
    // Nothing the Bedrock mantle endpoint lacks for Sonnet 5.
    expect(request).not.toHaveProperty('output_config')

    const content = request.messages[0].content as Anthropic.ContentBlockParam[]
    const documents = content.flatMap((block, i) => (block.type === 'document' ? [i] : []))
    expect(documents).toHaveLength(2)
    documents.forEach((index, n) => {
      const label = content[index - 1]
      expect(label.type).toBe('text')
      expect((label as Anthropic.TextBlockParam).text).toContain(pdfs[n].fileName)
      expect((content[index] as Anthropic.DocumentBlockParam).source).toEqual({
        type: 'base64',
        media_type: 'application/pdf',
        data: Buffer.from(pdfs[n].bytes).toString('base64'),
      })
    })
  })

  it('has no verdict, severity or judgement in its output schema (ADR 0001)', async () => {
    const { transport: t, requests } = transport(message([toolUse(toolInput())]))
    await createClaudeExtractor({ transport: t }).extract(pdfs)
    const schema = JSON.stringify(requests[0].tools![0])
    for (const word of ['verdict', 'severity', 'judgement', 'finding', 'correct', 'valid', 'plausib']) {
      expect(JSON.stringify((requests[0].tools![0] as Anthropic.Tool).input_schema)).not.toMatch(new RegExp(`"${word}`, 'i'))
    }
    expect(schema).toContain(BUILDING)
  })

  describe('rejects malformed model output as a failed extraction, never a partial one', () => {
    const malformed: [string, (input: ReturnType<typeof toolInput>) => unknown][] = [
      ['an amount in German notation', (i) => ((i.buildingFigures[1].value = '9.500,00'), i)],
      ['an amount with fractions of a cent', (i) => ((i.buildingFigures[1].value = '9500.001'), i)],
      ['a percentage that is not a number', (i) => ((i.buildingFigures[2].value = 'siebzig'), i)],
      ['an unknown allocation method', (i) => ((i.buildingFigures[3].value = 'mixed'), i)],
      ['an area precision of 3 decimals', (i) => ((i.buildingFigures[5].value = '3'), i)],
      ['a fractional CO₂ tier', (i) => ((i.buildingFigures[10].value = '7.5'), i)],
      ['an invalid date', (i) => ((i.buildingFigures[0].value = '2025-02-30/2025-12-31'), i)],
      ['an estimated flag that is not true or false', (i) => ((i.units[0].figures[2].value = 'ja'), i)],
      ['an unknown figure', (i) => (i.buildingFigures.push({ ...i.buildingFigures[1], figure: 'mood' }), i)],
      ['a figure reported twice', (i) => (i.buildingFigures.push(i.buildingFigures[1]), i)],
      ['a unit figure reported twice', (i) => (i.units[0].figures.push(i.units[0].figures[0]), i)],
      ['a file that was not uploaded', (i) => ((i.buildingFigures[1].file = 'Gesamtabrechnung.pdf'), i)],
      ['page 0', (i) => ((i.buildingFigures[1].page = 0), i)],
      ['a page the PDF does not have', (i) => ((i.buildingFigures[1].page = 3), i)],
      ['an extra field', (i) => ({ ...i, verdict: 'Die Abrechnung ist korrekt.' })],
      ['a missing list', ({ units: _, ...rest }) => rest],
      ['a missing quote', (i) => ({ ...i, costItems: [{ name: 'Wartung', file: BUILDING, page: 1 }] })],
      ['an empty Unit id', (i) => ((i.units[0].unitId = ' '), i)],
      ['not an object', () => 'Gesamtkosten 9.500,00 €'],
    ]
    it.each(malformed)('%s', async (_, spoil) => {
      await expect(extractWith(spoil(toolInput()))).rejects.toBeInstanceOf(ExtractionFailed)
    })

    it('no tool call', async () => {
      const t = transport(message([{ type: 'text', text: 'Ich kann das nicht lesen.' }], 'end_turn')).transport
      await expect(createClaudeExtractor({ transport: t }).extract(pdfs)).rejects.toBeInstanceOf(ExtractionFailed)
    })

    it('a refusal or a response cut off at max_tokens', async () => {
      for (const stop of ['refusal', 'max_tokens']) {
        const t = transport(message([toolUse(toolInput())], stop)).transport
        await expect(createClaudeExtractor({ transport: t }).extract(pdfs)).rejects.toBeInstanceOf(ExtractionFailed)
      }
    })

    it('two tool calls', async () => {
      const t = transport(message([toolUse(toolInput()), toolUse(toolInput())])).transport
      await expect(createClaudeExtractor({ transport: t }).extract(pdfs)).rejects.toBeInstanceOf(ExtractionFailed)
    })
  })

  it('fails when the API call fails', async () => {
    const t = transport(() => Promise.reject(new Error('overloaded'))).transport
    await expect(createClaudeExtractor({ transport: t }).extract(pdfs)).rejects.toBeInstanceOf(ExtractionFailed)
  })

  it('fails without calling the API when a PDF is unreadable', async () => {
    const { transport: t, requests } = transport(message([toolUse(toolInput())]))
    const broken = [{ fileName: 'kaputt.pdf', bytes: new TextEncoder().encode('%PDF-1.7 nonsense') }]
    await expect(createClaudeExtractor({ transport: t }).extract(broken)).rejects.toBeInstanceOf(ExtractionFailed)
    expect(requests).toHaveLength(0)
  })

  it('fails without calling the API when the package is over the request limits', async () => {
    for (const limits of [{ maxPages: 3 }, { maxBase64Bytes: 1000 }]) {
      const { transport: t, requests } = transport(message([toolUse(toolInput())]))
      await expect(createClaudeExtractor({ transport: t, limits }).extract(pdfs)).rejects.toThrow(ExtractionFailed)
      expect(requests).toHaveLength(0)
    }
  })
})
