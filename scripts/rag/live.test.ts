import { describe, expect, it } from 'vitest'
import { replyText } from './live'

describe('replyText', () => {
  it('returns a plain string reply as is', () => {
    expect(replyText('{"answerable": false}')).toBe('{"answerable": false}')
  })

  it('joins the text parts of a multi-part reply and skips other parts', () => {
    const parts = [
      { type: 'text', text: '{"answerable": ' },
      { type: 'thinking', thinking: 'hmm' },
      { type: 'text', text: 'false}' },
    ]

    expect(replyText(parts)).toBe('{"answerable": false}')
  })
})
