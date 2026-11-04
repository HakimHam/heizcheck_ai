import { describe, expect, it } from 'vitest'
import { isAuthorisedCron, REMOVE_BATCH_SIZE, runRetention, type RetentionStore } from './retention'

const NOW = new Date('2030-10-07T03:00:00Z')

/** A store that records every call, in order. */
function recordingStore(paths: string[], overrides: Partial<RetentionStore> = {}) {
  const calls: string[] = []
  const store: RetentionStore = {
    async expiredFiles(now) {
      calls.push(`list ${now.toISOString()}`)
      return paths
    },
    async removeFiles(batch) {
      calls.push(`remove ${batch.length}`)
    },
    async deleteExpired(now) {
      calls.push(`delete ${now.toISOString()}`)
      return 2
    },
    ...overrides,
  }
  return { store, calls }
}

describe('the retention job', () => {
  it('removes the expired PDFs first, then deletes the packages, both as of the same moment', async () => {
    const { store, calls } = recordingStore(['org/a/1.pdf', 'org/a/2.pdf', 'org/b/1.pdf'])
    expect(await runRetention(store, NOW)).toEqual({ removedFiles: 3, deletedPackages: 2 })
    expect(calls).toEqual([`list ${NOW.toISOString()}`, 'remove 3', `delete ${NOW.toISOString()}`])
  })

  it('removes PDFs in batches the Storage API accepts', async () => {
    const paths = Array.from({ length: REMOVE_BATCH_SIZE * 2 + 1 }, (_, i) => `org/p/${i}.pdf`)
    const { store, calls } = recordingStore(paths)
    await runRetention(store, NOW)
    expect(calls.filter((c) => c.startsWith('remove'))).toEqual([
      `remove ${REMOVE_BATCH_SIZE}`,
      `remove ${REMOVE_BATCH_SIZE}`,
      'remove 1',
    ])
  })

  it('removes nothing when nothing has expired', async () => {
    const { store, calls } = recordingStore([])
    await runRetention(store, NOW)
    expect(calls).not.toContain('remove 0')
  })

  it('keeps the packages when removing a PDF fails, so the next run retries', async () => {
    const { store, calls } = recordingStore(['org/a/1.pdf'], {
      async removeFiles() {
        throw new Error('Storage unavailable')
      },
    })
    await expect(runRetention(store, NOW)).rejects.toThrow('Storage unavailable')
    expect(calls.some((c) => c.startsWith('delete'))).toBe(false)
  })
})

describe('the retention job route', () => {
  const secret = 'cron-secret-with-enough-entropy'

  it('runs only with the cron secret Vercel sends', () => {
    expect(isAuthorisedCron(`Bearer ${secret}`, secret)).toBe(true)
    expect(isAuthorisedCron(`Bearer ${secret}x`, secret)).toBe(false)
    expect(isAuthorisedCron(secret, secret)).toBe(false)
    expect(isAuthorisedCron(null, secret)).toBe(false)
  })

  it('never runs when no secret is configured', () => {
    expect(isAuthorisedCron('Bearer ', '')).toBe(false)
    expect(isAuthorisedCron('Bearer undefined', undefined)).toBe(false)
  })
})
