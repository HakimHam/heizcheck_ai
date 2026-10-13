'use client'

import { usePathname } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { HELP_NOT_SENT, MAX_HELP_MESSAGE_LENGTH } from '@/lib/help-chat'

/**
 * The "?" button bottom-right that lets a Property Manager send a help message.
 * `/api/hilfe` forwards it to the n8n workflow, and the panel shows which
 * category it was filed under. The layout renders it only while the help chat
 * is on (ADR 0004).
 */
export function HelpChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function send() {
    const response = await fetch('/api/hilfe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, pagePath: pathname }),
    })
    const answer: unknown = await response.json().catch(() => null)
    const text = textOf(answer, 'text')
    if (response.ok && text) {
      setNotice(text)
      setMessage('')
    } else {
      setError(textOf(answer, 'error') ?? HELP_NOT_SENT)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSending(true)
    // On failure the text stays in the field, so the user can send it again.
    send()
      .catch(() => setError(HELP_NOT_SENT))
      .finally(() => setSending(false))
  }

  return (
    <div className="help-chat">
      {open && (
        <form className="help-panel stack" onSubmit={onSubmit} aria-label="Hilfe">
          <label>
            Wie können wir helfen?
            <textarea
              name="message"
              rows={5}
              maxLength={MAX_HELP_MESSAGE_LENGTH}
              required
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={sending}
            />
            <span className="hint">Bitte keine Mieterdaten eingeben.</span>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          {notice && <p className="notice" role="status">{notice}</p>}
          <button type="submit" disabled={sending}>{sending ? 'Wird gesendet …' : 'Senden'}</button>
        </form>
      )}
      <button
        type="button"
        className="help-toggle"
        aria-expanded={open}
        aria-label={open ? 'Hilfe schließen' : 'Hilfe öffnen'}
        onClick={() => setOpen(!open)}
      >
        {open ? '×' : '?'}
      </button>
    </div>
  )
}

/** A string field of the route's JSON answer, checked rather than cast. */
function textOf(answer: unknown, key: 'text' | 'error'): string | null {
  if (typeof answer !== 'object' || answer === null) return null
  const value: unknown = Reflect.get(answer, key)
  return typeof value === 'string' ? value : null
}
