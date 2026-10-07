import { describe, expect, it } from 'vitest'
// @ts-expect-error: plain .mjs script without type declarations
import { logEntry } from './agent-log.mjs'

const now = new Date('2026-10-07T10:00:00Z')

describe('agent-log hook', () => {
  it('records a Bash call with its command and the tail of its output', () => {
    const entry = logEntry(
      {
        session_id: 's1',
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'npm test' },
        tool_response: { stdout: 'Tests  263 passed (263)', stderr: '', interrupted: false },
        transcript_path: '/t.jsonl',
      },
      now,
    )
    expect(entry).toEqual({
      ts: '2026-10-07T10:00:00.000Z',
      session: 's1',
      event: 'PostToolUse',
      tool: 'Bash',
      target: 'npm test',
      output: 'Tests  263 passed (263)',
      interrupted: false,
      prompt: null,
      transcript: '/t.jsonl',
    })
  })

  it('records the file an Edit acted on, without its contents', () => {
    const entry = logEntry({
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: 'src/lib/b1.ts', old_string: 'secret', new_string: 'secret' },
      tool_response: { filePath: 'src/lib/b1.ts' },
    })
    expect(entry.target).toBe('src/lib/b1.ts')
    expect(entry.output).toBeNull()
    expect(JSON.stringify(entry)).not.toContain('secret')
  })

  it('records the user prompt and the end of a turn', () => {
    expect(logEntry({ hook_event_name: 'UserPromptSubmit', prompt: 'fix B1' })).toMatchObject({
      event: 'UserPromptSubmit',
      tool: null,
      prompt: 'fix B1',
    })
    expect(logEntry({ hook_event_name: 'Stop' })).toMatchObject({ event: 'Stop', target: null })
  })

  it('keeps only the last 400 characters of long output, where the test summary is', () => {
    const entry = logEntry({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
      tool_response: { stdout: `${'x'.repeat(1000)}Tests 263 passed` },
    })
    expect(entry.output).toHaveLength(401)
    expect(entry.output).toMatch(/^….*Tests 263 passed$/)
  })
})
