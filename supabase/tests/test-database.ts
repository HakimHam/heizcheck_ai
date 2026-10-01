import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations')

// The parts of a Supabase database our migrations rely on: the `auth` schema,
// `auth.uid()` and the `anon` / `authenticated` roles. Mirrors Supabase's own
// definitions closely enough for RLS policies to behave the same way.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public
    grant select, insert, update, delete on tables to anon, authenticated;
`

export type TestDatabase = {
  db: PGlite
  /** Creates a user the way Supabase sign-up does: one row in auth.users. */
  signUp(email: string, organisationName: string): Promise<string>
  /** Runs `fn` as that signed-in user, with RLS enforced. */
  asUser<T>(userId: string, fn: (db: PGlite) => Promise<T>): Promise<T>
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }

  return {
    db,
    async signUp(email, organisationName) {
      const id = crypto.randomUUID()
      await db.query(
        'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)',
        [id, email, JSON.stringify({ organisation_name: organisationName })],
      )
      return id
    },
    async asUser(userId, fn) {
      await db.query(`select set_config('request.jwt.claims', $1, false)`, [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ])
      await db.exec('set role authenticated')
      try {
        return await fn(db)
      } finally {
        await db.exec('reset role')
        await db.query(`select set_config('request.jwt.claims', '', false)`)
      }
    },
  }
}
