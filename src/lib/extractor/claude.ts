import type Anthropic from '@anthropic-ai/sdk'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { SourceReference } from '../figures'
import { type BboxLocator, createTextLayerLocator } from './bbox'
import { TOOL_DESCRIPTION, TOOL_NAME, toolInput, toolInputSchema } from './tool-schema'
import { ExtractionFailed, type Extractor, type StatementPdf } from './types'

/**
 * How requests reach Claude: the Anthropic API for development and the eval
 * (this ticket), Amazon Bedrock in `eu-west-1` in production (ticket 17).
 * The prompt, tool and validation stay the same on both.
 */
export type ClaudeTransport = {
  model: string
  send(request: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>
}

/** The API's limits for one request: 32 MB, and 600 pages of PDF. */
export type RequestLimits = { maxBase64Bytes: number; maxPages: number }

const API_LIMITS: RequestLimits = {
  // Leaves room for the prompt and tool within the 32 MB request.
  maxBase64Bytes: 31 * 1024 * 1024,
  maxPages: 600,
}

const SYSTEM = `You read German heating cost statements (Heizkostenabrechnungen) from a Metering Provider (Messdienstleister) for a property manager. A Statement Package is one building's Building Statement (Gesamtabrechnung) and all its Unit Statements (Einzelabrechnungen) for one Billing Period.

Your only job is to record what the statement states, through the ${TOOL_NAME} tool. Deterministic rules check the figures afterwards, so:
- Record figures exactly as stated, even when they look wrong or don't add up. Never correct, recompute or round them.
- Leave out any figure the statement doesn't show. Never estimate or infer one.
- Quote each figure's text exactly as printed, and give the file and page where you read it.
- Write Cost Item names and Unit ids exactly as printed.

Call the tool once, with every figure of the package.`

type Options = {
  transport: ClaudeTransport
  locator?: BboxLocator
  limits?: Partial<RequestLimits>
}

/**
 * Reads a Statement Package with Claude. All PDFs go in one request; the
 * figures come back through one strict tool and must pass the Zod contract,
 * or the extraction fails as a whole.
 */
export function createClaudeExtractor({ transport, locator = createTextLayerLocator(), limits }: Options): Extractor {
  const { maxBase64Bytes, maxPages } = { ...API_LIMITS, ...limits }

  return {
    async extract(pdfs) {
      const fileNames = pdfs.map((pdf) => pdf.fileName)
      if (pdfs.length === 0) throw new ExtractionFailed('The package has no PDFs.')
      if (new Set(fileNames).size !== fileNames.length) {
        // The source references find a PDF by its name.
        throw new ExtractionFailed('Two PDFs of the package have the same file name.')
      }

      const pages = await Promise.all(pdfs.map(countPages))
      const totalPages = pages.reduce((sum, n) => sum + n, 0)
      if (totalPages > maxPages) {
        throw new ExtractionFailed(`The package has ${totalPages} pages; at most ${maxPages} fit in one request.`)
      }
      const documents = pdfs.map((pdf) => Buffer.from(pdf.bytes).toString('base64'))
      const size = documents.reduce((sum, data) => sum + data.length, 0)
      if (size > maxBase64Bytes) {
        throw new ExtractionFailed(`The package is ${size} bytes encoded; at most ${maxBase64Bytes} fit in one request.`)
      }

      let response: Anthropic.Message
      try {
        response = await transport.send({
          model: transport.model,
          max_tokens: 64_000,
          system: SYSTEM,
          tools: [
            {
              name: TOOL_NAME,
              description: TOOL_DESCRIPTION,
              input_schema: toolInputSchema(fileNames) as Anthropic.Tool.InputSchema,
              strict: true,
            },
          ],
          tool_choice: { type: 'auto' },
          messages: [
            {
              role: 'user',
              content: [
                ...pdfs.flatMap((pdf, i): Anthropic.ContentBlockParam[] => [
                  { type: 'text', text: `File: ${pdf.fileName} (${pages[i]} pages)` },
                  { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: documents[i] } },
                ]),
                { type: 'text', text: `Record the figures of this Statement Package with the ${TOOL_NAME} tool.` },
              ],
            },
          ],
        })
      } catch (cause) {
        throw new ExtractionFailed('The request to Claude failed.', { cause })
      }

      if (response.stop_reason !== 'tool_use') {
        throw new ExtractionFailed(`Claude stopped with "${response.stop_reason}" instead of recording the figures.`)
      }
      const calls = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === TOOL_NAME,
      )
      if (calls.length !== 1) throw new ExtractionFailed(`Claude called the tool ${calls.length} times, not once.`)

      const parsed = toolInput(fileNames).safeParse(calls[0].input)
      if (!parsed.success) {
        throw new ExtractionFailed(`Claude's figures don't meet the schema: ${parsed.error.message}`)
      }
      const { figures, quotes } = parsed.data

      const entries = Object.entries(quotes)
      for (const [path, { file, page }] of entries) {
        if (page > pages[fileNames.indexOf(file)]) {
          throw new ExtractionFailed(`The source of ${path} is page ${page} of ${file}, which it doesn't have.`)
        }
      }

      const boxes = await locator.locate(pdfs, entries.map(([, quote]) => quote))
      const sources: Record<string, SourceReference> = {}
      entries.forEach(([path, quote], i) => {
        const bbox = boxes[i]
        sources[path] = bbox ? { ...quote, bbox } : quote
      })
      return { figures, sources }
    },
  }
}

async function countPages(pdf: StatementPdf): Promise<number> {
  // pdf.js takes ownership of the bytes it is given, so it gets a copy.
  const task = getDocument({ data: pdf.bytes.slice(), verbosity: 0 })
  try {
    return (await task.promise).numPages
  } catch (cause) {
    throw new ExtractionFailed(`${pdf.fileName} can't be read as a PDF.`, { cause })
  } finally {
    await task.destroy()
  }
}
