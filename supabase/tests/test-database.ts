import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const supabaseDir = join(__dirname, "..");
const migrationsDir = join(supabaseDir, "migrations");

/**
 * An in-process Postgres with the Supabase shim and every migration applied.
 * Queries run either as the database owner (setup) or as a signed-in user,
 * the way PostgREST runs them: role `authenticated` with the user's JWT claims.
 */
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }

  async function runAs<T>(role: "authenticated" | "anon", claims: object, sql: string, params: unknown[]) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      await tx.exec(`set local role ${role}`);
      const { rows } = await tx.query<T>(sql, params);
      return rows;
    });
  }

  return {
    /** Simulates Supabase sign-up: a new row in auth.users with its metadata. */
    async signUp(email: string, metadata: Record<string, unknown>) {
      const { rows } = await db.query<{ id: string }>(
        "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
        [email, JSON.stringify(metadata)],
      );
      return rows[0].id;
    },

    /** Runs one query as the given signed-in user, under row-level security. */
    async as<T>(userId: string, sql: string, params: unknown[] = []) {
      return runAs<T>("authenticated", { sub: userId, role: "authenticated" }, sql, params);
    },

    /** Runs one query as a visitor who isn't signed in. */
    async asAnonymous<T>(sql: string, params: unknown[] = []) {
      return runAs<T>("anon", { role: "anon" }, sql, params);
    },

    /** Runs a query as the database owner, bypassing row-level security. */
    async admin<T>(sql: string, params: unknown[] = []) {
      const { rows } = await db.query<T>(sql, params);
      return rows;
    },
  };
}
