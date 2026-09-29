import { expect, it } from "vitest";
import { createTestDatabase } from "./test-database";

// Guards future migrations: a table in the exposed schema without RLS would be
// readable by every signed-in user across all Organisations.
it("enables row-level security on every table in the public schema", async () => {
  const db = await createTestDatabase();

  const unprotected = await db.admin<{ table: string }>(`
    select c.relname as table
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  `);

  expect(unprotected).toEqual([]);
});
