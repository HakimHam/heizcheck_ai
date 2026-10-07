// Claude Code hook: appends one JSON line per agent event to
// .observability/agent-log.jsonl, so an agent's work can be reviewed and
// counted afterwards (which tools it ran, whether it ran the tests, what they
// printed). It only records; it never blocks the agent.
//
//   node scripts/agent-log.mjs   (reads the hook's JSON from stdin)
//
// The log is gitignored: command output can contain secrets or statement data.

import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** How much of a command and its output to keep: enough for a Vitest summary. */
const MAX_CHARS = 400

const clip = (text) =>
  typeof text === 'string' && text.length > MAX_CHARS ? `…${text.slice(-MAX_CHARS)}` : (text ?? null)

/** What a tool call acted on: the command, file or search pattern. */
const targetOf = (input = {}) =>
  input.command ?? input.file_path ?? input.pattern ?? input.url ?? input.skill ?? input.description ?? null

/**
 * Turns a Claude Code hook payload into one log entry.
 * `{ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'npm test' }, ... }`
 * → `{ event: 'PostToolUse', tool: 'Bash', target: 'npm test', output: '…Tests 263 passed', ... }`
 */
export const logEntry = (payload, now = new Date()) => {
  const response = payload.tool_response ?? {}
  return {
    ts: now.toISOString(),
    session: payload.session_id ?? null,
    event: payload.hook_event_name ?? null,
    tool: payload.tool_name ?? null,
    target: clip(targetOf(payload.tool_input)),
    // Bash only: the tail of what it printed, where test and typecheck results end up.
    output: payload.tool_name === 'Bash' ? clip([response.stdout, response.stderr].filter(Boolean).join('\n')) : null,
    interrupted: response.interrupted ?? null,
    prompt: clip(payload.prompt),
    transcript: payload.transcript_path ?? null,
  }
}

const main = async () => {
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  const payload = JSON.parse(raw)
  const file = join(process.env.CLAUDE_PROJECT_DIR ?? payload.cwd ?? '.', '.observability', 'agent-log.jsonl')
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify(logEntry(payload))}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  // A broken log must never get in the agent's way.
  main().catch((error) => console.error(`agent-log: ${error.message}`))
}
