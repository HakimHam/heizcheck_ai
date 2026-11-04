import { describe, expect, it } from 'vitest'
import { supabaseRetentionStore, type RetentionClient } from './retention-store'

const NOW = new Date('2030-10-07T03:00:00Z')

/** A Supabase client that answers every RPC with `answers[fn]` and records storage removals. */
function fakeClient(answers: Record<string, { data: unknown; error: { message: string } | null }>, removeError: string | null = null) {
  const rpcs: { fn: string; args: unknown }[] = []
  const removed: { bucket: string; paths: string[] }[] = []
  const client: RetentionClient = {
    rpc: async (fn, args) => {
      rpcs.push({ fn, args })
      return answers[fn]
    },
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          removed.push({ bucket, paths })
          return { error: removeError ? { message: removeError } : null }
        },
      }),
    },
  }
  return { client, rpcs, removed }
}

describe('the Supabase retention store', () => {
  it('asks the database as of the given moment and removes PDFs from the statement bucket', async () => {
    const { client, rpcs, removed } = fakeClient({
      expired_statement_package_files: { data: ['org/a/1.pdf'], error: null },
      delete_expired_statement_packages: { data: 1, error: null },
    })
    const store = supabaseRetentionStore(client)

    expect(await store.expiredFiles(NOW)).toEqual(['org/a/1.pdf'])
    await store.removeFiles(['org/a/1.pdf'])
    expect(await store.deleteExpired(NOW)).toBe(1)

    expect(rpcs).toEqual([
      { fn: 'expired_statement_package_files', args: { p_now: '2030-10-07T03:00:00.000Z' } },
      { fn: 'delete_expired_statement_packages', args: { p_now: '2030-10-07T03:00:00.000Z' } },
    ])
    expect(removed).toEqual([{ bucket: 'statement-packages', paths: ['org/a/1.pdf'] }])
  })

  it('fails on a database or storage error instead of carrying on', async () => {
    const failing = fakeClient(
      {
        expired_statement_package_files: { data: null, error: { message: 'permission denied' } },
        delete_expired_statement_packages: { data: null, error: { message: 'permission denied' } },
      },
      'Object store unavailable',
    )
    const store = supabaseRetentionStore(failing.client)
    await expect(store.expiredFiles(NOW)).rejects.toThrow('permission denied')
    await expect(store.deleteExpired(NOW)).rejects.toThrow('permission denied')
    await expect(store.removeFiles(['org/a/1.pdf'])).rejects.toThrow('Object store unavailable')
  })

  it('refuses database answers of the wrong shape', async () => {
    const { client } = fakeClient({
      expired_statement_package_files: { data: [{ path: 'org/a/1.pdf' }], error: null },
      delete_expired_statement_packages: { data: '1', error: null },
    })
    const store = supabaseRetentionStore(client)
    await expect(store.expiredFiles(NOW)).rejects.toThrow(/unexpected answer/)
    await expect(store.deleteExpired(NOW)).rejects.toThrow(/unexpected answer/)
  })
})
