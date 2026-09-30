import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");
const SHIM = join(import.meta.dirname, "supabase-shim.sql");

export type TestDatabase = {
  /** Registers a user the way Supabase auth does on sign-up. */
  signUp(input: { email: string; organisationName?: string }): Promise<string>;
  /** Runs queries as a signed-in user, subject to row-level security. */
  asUser<T>(userId: string, run: (tx: Transaction) => Promise<T>): Promise<T>;
  /** Runs queries as a visitor who is not signed in. */
  asAnonymous<T>(run: (tx: Transaction) => Promise<T>): Promise<T>;
  /** Runs queries as the database owner, bypassing row-level security, to set up or inspect state. */
  asDatabaseOwner<T>(run: (tx: Transaction) => Promise<T>): Promise<T>;
  /** The Organisation a user belongs to. */
  organisationIdOf(userId: string): Promise<string>;
  close(): Promise<void>;
};

/** A fresh Postgres with Supabase's auth shim and every migration applied. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const pg = await PGlite.create();
  await pg.exec(readFileSync(SHIM, "utf8"));
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }

  return {
    async signUp({ email, organisationName }) {
      const metadata = organisationName === undefined ? {} : { organisation_name: organisationName };
      const { rows } = await pg.query<{ id: string }>(
        "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
        [email, JSON.stringify(metadata)],
      );
      return rows[0].id;
    },

    async asUser(userId, run) {
      return pg.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: userId, role: "authenticated" }),
        ]);
        await tx.exec("set local role authenticated");
        return run(tx);
      });
    },

    async asAnonymous(run) {
      return pg.transaction(async (tx) => {
        await tx.exec("set local role anon");
        return run(tx);
      });
    },

    asDatabaseOwner: (run) => pg.transaction(run),

    async organisationIdOf(userId) {
      const { rows } = await pg.query<{ organisation_id: string }>(
        "select organisation_id from organisation_members where user_id = $1",
        [userId],
      );
      return rows[0].organisation_id;
    },

    close: () => pg.close(),
  };
}

/**
 * Runs a write that Postgres may refuse outright or row-level security may
 * silently filter. Any other error (a typo in the SQL, say) still fails the
 * test, so "nothing changed" can't pass by accident.
 */
export async function attempt(write: Promise<unknown>): Promise<void> {
  await write.catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!/row-level security|permission denied/.test(message)) throw error;
  });
}
