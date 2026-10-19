import { afterEach, describe, expect, it, vi } from 'vitest'
import { forwardHelpMessage, helpChatEnabled } from './help-chat'

describe('the help chat switch', () => {
  it('is on only when the n8n webhook URL is set (ADR 0004: unset in production)', () => {
    expect(helpChatEnabled({ N8N_HELP_WEBHOOK_URL: 'https://n8n.test/webhook/hilfe' })).toBe(true)
    expect(helpChatEnabled({ N8N_HELP_WEBHOOK_URL: '' })).toBe(false)
    expect(helpChatEnabled({})).toBe(false)
  })
})

const WEBHOOK = 'https://n8n.test/webhook/hilfe'
const SECRET = 'n8n-secret-with-enough-entropy'
const sender = {
  userId: '0b6c1f8e-3d4a-4f6b-9c2d-1e2f3a4b5c6d',
  email: 'pm@hausverwaltung.de',
  organisationName: 'Muster Hausverwaltung GmbH',
}

/** A fake n8n: records each call and answers with `reply`. */
const n8n = (reply: () => Promise<Response>) => {
  const calls: { url: string; headers: Record<string, string>; body: unknown }[] = []
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) })
    return reply()
  }
  return { fetch, calls }
}

const forward = (body: unknown, fetch: (url: string, init?: RequestInit) => Promise<Response>) =>
  forwardHelpMessage(body, sender, {
    env: { N8N_HELP_WEBHOOK_URL: WEBHOOK, N8N_HELP_WEBHOOK_SECRET: SECRET },
    fetch,
    now: new Date('2026-10-13T09:12:00.000Z'),
    newId: () => 'a1b2c3d4-0000-4000-8000-000000000001',
  })

describe('forwarding a help message to n8n', () => {
  it('sends the message with the sender from the session, and shows the category n8n chose', async () => {
    const { fetch, calls } = n8n(async () =>
      Response.json({ category: 'datenschutz', summary: 'Bittet um Löschung der Daten.' }),
    )

    const result = await forward({ message: '  Bitte löschen Sie unsere Daten.  ', pagePath: '/pakete/3f2a' }, fetch)

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(WEBHOOK)
    expect(calls[0].headers['X-HeizCheck-Secret']).toBe(SECRET)
    expect(calls[0].body).toEqual({
      requestId: 'a1b2c3d4-0000-4000-8000-000000000001',
      message: 'Bitte löschen Sie unsere Daten.',
      pagePath: '/pakete/3f2a',
      user: { id: '0b6c1f8e-3d4a-4f6b-9c2d-1e2f3a4b5c6d', email: 'pm@hausverwaltung.de' },
      organisationName: 'Muster Hausverwaltung GmbH',
      sentAt: '2026-10-13T09:12:00.000Z',
    })
    expect(result).toEqual({
      status: 200,
      answer: {
        outcome: 'classified',
        category: 'datenschutz',
        label: 'Datenschutz',
        summary: 'Bittet um Löschung der Daten.',
        text: 'Danke! Ihre Anfrage wurde als „Datenschutz“ eingeordnet. Wir melden uns per E-Mail.',
      },
    })
  })
})

const classified = () => Response.json({ category: 'sonstiges', summary: 'Eine Frage.' })

describe('the message limits', () => {
  // 2000 characters fit a long question but keep the model call small.
  it.each([
    ['1 character', 'a'],
    ['2000 characters', 'a'.repeat(2000)],
    ['2000 characters after trimming', `  ${'a'.repeat(2000)}  `],
  ])('forwards a message of %s', async (_, message) => {
    const { fetch, calls } = n8n(async () => classified())
    const result = await forward({ message, pagePath: '/' }, fetch)
    expect(result.status).toBe(200)
    expect(calls).toHaveLength(1)
  })

  it.each([
    ['empty', ''],
    ['only whitespace', '   \n '],
    ['2001 characters', 'a'.repeat(2001)],
  ])('refuses a message that is %s, without calling n8n', async (_, message) => {
    const { fetch, calls } = n8n(async () => classified())
    const result = await forward({ message, pagePath: '/' }, fetch)
    expect(result).toEqual({ status: 400, answer: { outcome: 'invalid', error: expect.any(String) } })
    expect(calls).toHaveLength(0)
  })

  it('says in German what is wrong', async () => {
    const { fetch } = n8n(async () => classified())
    expect(await forward({ message: '', pagePath: '/' }, fetch)).toMatchObject({
      answer: { error: 'Bitte geben Sie eine Nachricht ein.' },
    })
    expect(await forward({ message: 'a'.repeat(2001), pagePath: '/' }, fetch)).toMatchObject({
      answer: { error: 'Die Nachricht darf höchstens 2000 Zeichen lang sein.' },
    })
  })
})

describe('the page the message was sent from', () => {
  it.each([
    ['the start page', '/'],
    ['200 characters', `/${'a'.repeat(199)}`],
  ])('forwards a path of %s', async (_, pagePath) => {
    const { fetch, calls } = n8n(async () => classified())
    expect((await forward({ message: 'Hilfe', pagePath }, fetch)).status).toBe(200)
    expect(calls[0].body).toMatchObject({ pagePath })
  })

  it.each([
    ['201 characters', `/${'a'.repeat(200)}`],
    ['no leading slash', 'pakete/3f2a'],
    ['a full URL', 'https://evil.test/'],
    ['a protocol-relative URL', '//evil.test/'],
    ['missing', undefined],
  ])('refuses a path with %s, without calling n8n', async (_, pagePath) => {
    const { fetch, calls } = n8n(async () => classified())
    expect((await forward({ message: 'Hilfe', pagePath }, fetch)).status).toBe(400)
    expect(calls).toHaveLength(0)
  })
})

describe('a request body that is not a help message', () => {
  it.each([null, 'Hilfe', [], 42])('refuses %j without calling n8n', async (body) => {
    const { fetch, calls } = n8n(async () => classified())
    expect((await forward(body, fetch)).status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('ignores a sender the browser made up, and sends the one from the session', async () => {
    const { fetch, calls } = n8n(async () => classified())
    await forward(
      {
        message: 'Hilfe',
        pagePath: '/',
        user: { id: 'someone-else', email: 'boss@evil.test' },
        organisationName: 'Andere GmbH',
      },
      fetch,
    )
    expect(calls[0].body).toMatchObject({
      user: { id: sender.userId, email: sender.email },
      organisationName: sender.organisationName,
    })
  })
})

const RECEIVED = { status: 200, answer: { outcome: 'received', text: 'Ihre Nachricht ist angekommen. Wir melden uns per E-Mail.' } }
const FAILED = {
  status: 502,
  answer: { outcome: 'failed', error: 'Nachricht konnte nicht gesendet werden. Bitte später erneut versuchen.' },
}

describe('when n8n answers with something unexpected', () => {
  // The reply is model output, so it is untrusted: the message still arrived,
  // the user just doesn't see a category.
  it.each([
    ['an unknown category', () => Response.json({ category: 'dringend', summary: 'x' })],
    ['no summary', () => Response.json({ category: 'datenschutz' })],
    ['no JSON', () => new Response('Workflow was started')],
    ['an empty body', () => new Response(null)],
  ])('says the message arrived when the reply has %s', async (_, reply) => {
    const { fetch } = n8n(async () => reply())
    expect(await forward({ message: 'Hilfe', pagePath: '/' }, fetch)).toEqual(RECEIVED)
  })
})

describe('when n8n is not reachable', () => {
  afterEach(() => vi.useRealTimers())

  it.each([401, 404, 500])('says the message was not sent when n8n answers HTTP %i', async (status) => {
    const { fetch } = n8n(async () => Response.json({ category: 'sonstiges', summary: 'x' }, { status }))
    expect(await forward({ message: 'Hilfe', pagePath: '/' }, fetch)).toEqual(FAILED)
  })

  it('says the message was not sent when the network fails', async () => {
    const { fetch } = n8n(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await forward({ message: 'Hilfe', pagePath: '/' }, fetch)).toEqual(FAILED)
  })

  it('waits 10 seconds for n8n and then gives up', async () => {
    vi.useFakeTimers()
    const hanging = (_url: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        // Answers after 10.001 s, too late.
        setTimeout(() => resolve(Response.json({ category: 'sonstiges', summary: 'x' })), 10_001)
      })
    const result = forward({ message: 'Hilfe', pagePath: '/' }, hanging)
    let settled = false
    result.then(() => (settled = true))

    await vi.advanceTimersByTimeAsync(9_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toEqual(FAILED)
  })

  it('takes an answer that arrives just before the 10 seconds are up', async () => {
    vi.useFakeTimers()
    const slow = () =>
      new Promise<Response>((resolve) =>
        setTimeout(() => resolve(Response.json({ category: 'sonstiges', summary: 'x' })), 9_999),
      )
    const result = forward({ message: 'Hilfe', pagePath: '/' }, slow)
    await vi.advanceTimersByTimeAsync(9_999)
    expect((await result).answer.outcome).toBe('classified')
  })
})

describe("the summary from n8n's model", () => {
  // 140 characters fit one line in the widget and in the alert subject.
  it('is shown at 140 characters', async () => {
    const summary = 'a'.repeat(140)
    const { fetch } = n8n(async () => Response.json({ category: 'befund_frage', summary }))
    expect((await forward({ message: 'Hilfe', pagePath: '/' }, fetch)).answer).toMatchObject({
      outcome: 'classified',
      label: 'Frage zu einem Befund',
      summary,
    })
  })

  it.each([
    ['141 characters', 'a'.repeat(141)],
    ['empty', ''],
  ])('is not trusted when it is %s', async (_, summary) => {
    const { fetch } = n8n(async () => Response.json({ category: 'befund_frage', summary }))
    expect(await forward({ message: 'Hilfe', pagePath: '/' }, fetch)).toEqual(RECEIVED)
  })
})
