import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attempt, createTestDatabase, type TestDatabase } from "./test-database";

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.close();
});

describe("signing up", () => {
  it("creates the user's Organisation with the user as its only member", async () => {
    const userId = await db.signUp({ email: "anna@verwaltung-a.de", organisationName: "Verwaltung A" });

    const organisations = await db.asUser(userId, (tx) =>
      tx.query<{ name: string }>("select name from organisations"),
    );
    const members = await db.asUser(userId, (tx) =>
      tx.query<{ user_id: string }>("select user_id from organisation_members"),
    );

    expect(organisations.rows).toEqual([{ name: "Verwaltung A" }]);
    expect(members.rows).toEqual([{ user_id: userId }]);
  });

  it("is refused without an Organisation name, so no user is left without one", async () => {
    await expect(db.signUp({ email: "ohne@verwaltung.de" })).rejects.toThrow();
    await expect(db.signUp({ email: "leer@verwaltung.de", organisationName: "   " })).rejects.toThrow();
  });
});

describe("Organisation isolation", () => {
  it("shows a user only their own Organisation and its members", async () => {
    const anna = await db.signUp({ email: "anna@verwaltung-a.de", organisationName: "Verwaltung A" });
    const ben = await db.signUp({ email: "ben@verwaltung-b.de", organisationName: "Verwaltung B" });

    const { organisations, members } = await db.asUser(ben, async (tx) => ({
      organisations: (await tx.query<{ name: string }>("select name from organisations")).rows,
      members: (await tx.query<{ user_id: string }>("select user_id from organisation_members")).rows,
    }));

    expect(organisations).toEqual([{ name: "Verwaltung B" }]);
    expect(members).toEqual([{ user_id: ben }]);
    expect(members).not.toContainEqual({ user_id: anna });
  });

  it("does not let a user join or rename another Organisation", async () => {
    const anna = await db.signUp({ email: "anna@verwaltung-a.de", organisationName: "Verwaltung A" });
    const ben = await db.signUp({ email: "ben@verwaltung-b.de", organisationName: "Verwaltung B" });
    const annasOrganisationId = await db.organisationIdOf(anna);

    await attempt(db.asUser(ben, (tx) =>
      tx.query("update organisation_members set organisation_id = $1 where user_id = $2", [annasOrganisationId, ben]),
    ));
    await attempt(db.asUser(ben, (tx) =>
      tx.query("insert into organisation_members (user_id, organisation_id) values ($1, $2)", [ben, annasOrganisationId]),
    ));
    await attempt(db.asUser(ben, (tx) =>
      tx.query("update organisations set name = 'Übernommen' where id = $1", [annasOrganisationId]),
    ));

    const state = await db.asDatabaseOwner(async (tx) => ({
      membership: (await tx.query("select o.name from organisation_members m join organisations o on o.id = m.organisation_id where m.user_id = $1", [ben])).rows,
      annasName: (await tx.query("select name from organisations where id = $1", [annasOrganisationId])).rows,
    }));
    expect(state.membership).toEqual([{ name: "Verwaltung B" }]);
    expect(state.annasName).toEqual([{ name: "Verwaltung A" }]);
  });
});
