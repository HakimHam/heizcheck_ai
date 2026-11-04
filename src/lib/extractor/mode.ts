const MODES = ['fake', 'anthropic', 'bedrock'] as const
export type ExtractorMode = (typeof MODES)[number]

export type Env = Record<string, string | undefined>

/** Which Extractor `EXTRACTOR` selects; the fake if it's unset. */
export function extractorMode(env: Env = process.env): ExtractorMode {
  const mode = env.EXTRACTOR || 'fake'
  if (!MODES.includes(mode as ExtractorMode)) {
    throw new Error(`EXTRACTOR must be one of ${MODES.join(', ')}, not "${mode}".`)
  }
  return mode as ExtractorMode
}
