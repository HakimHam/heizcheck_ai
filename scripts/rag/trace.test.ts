import { describe, expect, it } from 'vitest'
import { parseAskArgs, PREVIEW_NUMBERS, vectorPreview } from './trace'

describe('parseAskArgs', () => {
  it('joins the words into one question', () => {
    expect(parseAskArgs(['Wann', 'wird', 'gelöscht?'])).toEqual({ question: 'Wann wird gelöscht?', trace: false })
  })

  it('takes --trace anywhere and leaves it out of the question', () => {
    expect(parseAskArgs(['--trace', 'Wann wird gelöscht?'])).toEqual({ question: 'Wann wird gelöscht?', trace: true })
    expect(parseAskArgs(['Wann wird gelöscht?', '--trace'])).toEqual({ question: 'Wann wird gelöscht?', trace: true })
  })

  it.each([[[]], [['--trace']], [['hi']]])('rejects %j as no valid question', (argv) => {
    expect(parseAskArgs(argv)).toBeNull()
  })
})

describe('vectorPreview', () => {
  const v = (length: number) => Array.from({ length }, (_, i) => i / 10)

  it(`shows the first ${PREVIEW_NUMBERS} numbers and the vector's length`, () => {
    expect(PREVIEW_NUMBERS).toBe(5)
    expect(vectorPreview([0.01234, -0.5, 0, 0.1, 0.2, 0.3, 0.4])).toBe(
      '[0.0123, -0.5000, 0.0000, 0.1000, 0.2000, …] (7 Zahlen)',
    )
  })

  it.each([
    { length: PREVIEW_NUMBERS - 1, ellipsis: false },
    { length: PREVIEW_NUMBERS, ellipsis: false },
    { length: PREVIEW_NUMBERS + 1, ellipsis: true },
  ])('with $length numbers, shortens: $ellipsis', ({ length, ellipsis }) => {
    const preview = vectorPreview(v(length))

    expect(preview.includes('…')).toBe(ellipsis)
    expect(preview).toContain(`(${length} Zahlen)`)
  })
})
