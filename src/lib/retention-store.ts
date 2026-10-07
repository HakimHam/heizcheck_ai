import { z } from 'zod'
import type { RetentionStore } from './retention'
import { PDF_BUCKET } from './upload'

type SupabaseError = { message: string } | null

/** The part of a Supabase client the retention job uses. It must act as the service role. */
export type RetentionClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: SupabaseError }>
  storage: { from(bucket: string): { remove(paths: string[]): PromiseLike<{ error: SupabaseError }> } }
}

const expiredFilesAnswer = z.array(z.string().min(1))
const deletedAnswer = z.number().int().nonnegative()

/** Calls a retention function and checks its answer: a malformed one must stop the job, not steer it. */
async function callRetentionRpc<T>(client: RetentionClient, fn: string, now: Date, answer: z.ZodType<T>): Promise<T> {
  const { data, error } = await client.rpc(fn, { p_now: now.toISOString() })
  if (error) throw new Error(`${fn} failed: ${error.message}`)
  const parsed = answer.safeParse(data)
  if (!parsed.success) throw new Error(`${fn} gave an unexpected answer: ${parsed.error.message}`)
  return parsed.data
}

/**
 * The retention job's store on Supabase: the database decides what has
 * expired, and PDFs are removed through the Storage API so the files go too,
 * not only their rows.
 */
export function supabaseRetentionStore(client: RetentionClient): RetentionStore {
  return {
    expiredFiles: (now) => callRetentionRpc(client, 'expired_statement_package_files', now, expiredFilesAnswer),
    async removeFiles(paths) {
      const { error } = await client.storage.from(PDF_BUCKET).remove(paths)
      if (error) throw new Error(`Removing PDFs failed: ${error.message}`)
    },
    deleteExpired: (now) => callRetentionRpc(client, 'delete_expired_statement_packages', now, deletedAnswer),
  }
}
