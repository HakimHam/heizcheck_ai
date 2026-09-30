import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./test-database";

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.close();
});

it("is enabled on every table in the public schema", async () => {
  const unprotected = await db.asDatabaseOwner(async (tx) =>
    (await tx.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and not rowsecurity order by tablename",
    )).rows,
  );

  expect(unprotected).toEqual([]);
});

it("shows a visitor who is not signed in nothing", async () => {
  const anna = await db.signUp({ email: "anna@verwaltung-a.de", organisationName: "Verwaltung A" });
  await db.asUser(anna, (tx) => tx.query("insert into buildings (address, residential) values ('Hauptstraße 1, 10115 Berlin', true)"));

  const visible = await db.asAnonymous(async (tx) => ({
    organisations: (await tx.query("select * from organisations")).rows,
    members: (await tx.query("select * from organisation_members")).rows,
    buildings: (await tx.query("select * from buildings")).rows,
  }));

  expect(visible).toEqual({ organisations: [], members: [], buildings: [] });
});
