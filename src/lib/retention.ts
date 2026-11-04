import { createHash, timingSafeEqual } from 'node:crypto'

// The retention job: Statement Packages, their PDFs and their Check Reports are
// deleted 4 years after they were created (12-month objection window,
// §556 para 3 sentence 5 BGB, plus the 3-year limitation period, §195 BGB).
// Which packages have expired is decided in the database
// (supabase/migrations/20261007090000_retention.sql); this module only runs
// the steps in a safe order.

/** Where the retention job reads and deletes. The real one is Supabase; tests pass a fake. */
export type RetentionStore = {
  /** Storage paths of the PDFs of every package that has expired at `now`. */
  expiredFiles(now: Date): Promise<string[]>
  /** Removes these PDFs from storage. Throws if any removal fails. */
  removeFiles(paths: string[]): Promise<void>
  /** Deletes the packages that have expired at `now`, with their Check Reports; returns how many. */
  deleteExpired(now: Date): Promise<number>
}

/** What one run deleted, for the job's log. */
export type RetentionResult = { removedFiles: number; deletedPackages: number }

/** How many PDFs one Storage API call removes; Supabase accepts at most 1000. */
export const REMOVE_BATCH_SIZE = 1000

/**
 * Deletes everything that has expired at `now`. PDFs go first: if removing one
 * fails, the packages stay, and the next run finds and retries them. Deleting
 * the packages first would leave PDFs that nothing points to and nothing
 * would ever delete.
 */
export async function runRetention(store: RetentionStore, now: Date): Promise<RetentionResult> {
  const paths = await store.expiredFiles(now)
  for (let i = 0; i < paths.length; i += REMOVE_BATCH_SIZE) {
    await store.removeFiles(paths.slice(i, i + REMOVE_BATCH_SIZE))
  }
  const deletedPackages = await store.deleteExpired(now)
  return { removedFiles: paths.length, deletedPackages }
}

const digest = (value: string) => createHash('sha256').update(value).digest()

/**
 * Whether a request carries the cron secret, as Vercel Cron sends it:
 * `Authorization: Bearer <CRON_SECRET>`. Without a configured secret nothing
 * is authorised, so a missing variable can't open the job to everyone.
 */
export function isAuthorisedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || authorization === null) return false
  // Compared as hashes, in constant time, so the response time reveals nothing.
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))
}
