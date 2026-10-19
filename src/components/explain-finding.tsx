'use client'

import { type FormEvent, useState } from 'react'
import type { RuleId } from '@/lib/check-engine'
import { EXPLAIN_FAILED, MAX_QUESTION_LENGTH } from '@/lib/explain-chat/explain'

/** The question the panel opens with: the one the explain chat is built to answer. */
const DEFAULT_QUESTION = 'Was bedeutet dieser Befund und was soll ich jetzt tun?'

type Answer = { answer: string; sources: { file: string; heading: string }[] }

/**
 * The "Erklären" button under a rule with a Finding. It opens a panel that
 * sends the rule ID and one question to `/api/erklaerung` and shows the answer
 * with the knowledge base sections it came from. The Check Report renders it
 * only while the explain chat is on (ADR 0005).
 */
export function ExplainFinding({ ruleId }: { ruleId: RuleId }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState(DEFAULT_QUESTION)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)

  async function ask() {
    const response = await fetch('/api/erklaerung', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId, question }),
    })
    const body: unknown = await response.json().catch(() => null)
    const parsed = parseAnswer(body)
    if (response.ok && parsed) setAnswer(parsed)
    else setError(errorOf(body) ?? EXPLAIN_FAILED)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setAnswer(null)
    setAsking(true)
    ask()
      .catch(() => setError(EXPLAIN_FAILED))
      .finally(() => setAsking(false))
  }

  if (!open) {
    return (
      <button type="button" className="secondary explain-toggle" onClick={() => setOpen(true)}>
        Erklären
      </button>
    )
  }

  return (
    <form className="explain-panel stack" onSubmit={onSubmit} aria-label={`Befund ${ruleId} erklären`}>
      <label>
        Ihre Frage zu {ruleId}
        <textarea
          name="question"
          rows={2}
          maxLength={MAX_QUESTION_LENGTH}
          required
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={asking}
        />
        <span className="hint">Bitte keine Mieterdaten eingeben. Die Antwort ist keine Rechtsberatung.</span>
      </label>
      <div className="explain-actions">
        <button type="submit" disabled={asking}>{asking ? 'Wird erklärt …' : 'Fragen'}</button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>Schließen</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {answer && (
        <div className="explain-answer" role="status">
          <p>{answer.answer}</p>
          {answer.sources.length > 0 && (
            <p className="hint">
              Quellen: {answer.sources.map((source) => `${source.file} › ${source.heading}`).join(' · ')}
            </p>
          )}
        </div>
      )}
    </form>
  )
}

/** The route's answer, checked rather than cast. */
function parseAnswer(value: unknown): Answer | null {
  if (typeof value !== 'object' || value === null) return null
  const answer: unknown = Reflect.get(value, 'answer')
  const sources: unknown = Reflect.get(value, 'sources')
  if (typeof answer !== 'string' || !Array.isArray(sources)) return null
  const valid = sources.filter(
    (source): source is Answer['sources'][number] =>
      typeof source?.file === 'string' && typeof source?.heading === 'string',
  )
  return { answer, sources: valid }
}

function errorOf(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null
  const error: unknown = Reflect.get(value, 'error')
  return typeof error === 'string' ? error : null
}
