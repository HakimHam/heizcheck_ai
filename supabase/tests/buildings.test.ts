import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attempt, createTestDatabase, type TestDatabase } from "./test-database";

let db: TestDatabase;
let anna: string;
let ben: string;

beforeEach(async () => {
  db = await createTestDatabase();
  anna = await db.signUp({ email: "anna@verwaltung-a.de", organisationName: "Verwaltung A" });
  ben = await db.signUp({ email: "ben@verwaltung-b.de", organisationName: "Verwaltung B" });
});

afterEach(async () => {
  await db.close();
});

const listAddresses = (userId: string) =>
  db.asUser(userId, async (tx) =>
    (await tx.query<{ address: string }>("select address from buildings order by address")).rows.map((r) => r.address),
  );

const addBuilding = (userId: string, address: string) =>
  db.asUser(userId, (tx) => tx.query("insert into buildings (address) values ($1)", [address]));

describe("buildings", () => {
  it("start empty for a new Organisation", async () => {
    expect(await listAddresses(anna)).toEqual([]);
  });

  it("belong to the Organisation of the member who adds them", async () => {
    await addBuilding(anna, "Hauptstraße 1, 10115 Berlin");

    expect(await listAddresses(anna)).toEqual(["Hauptstraße 1, 10115 Berlin"]);
    expect(await listAddresses(ben)).toEqual([]);
  });

  it("are shared with equal rights by every member of the Organisation", async () => {
    const carla = await db.signUp({ email: "carla@verwaltung-c.de", organisationName: "Verwaltung C" });
    await db.asDatabaseOwner((tx) =>
      tx.query(
        `update organisation_members
            set organisation_id = (select organisation_id from organisation_members where user_id = $1)
          where user_id = $2`,
        [anna, carla],
      ),
    );
    await addBuilding(anna, "Hauptstraße 1, 10115 Berlin");

    await db.asUser(carla, (tx) => tx.query("update buildings set address = 'Hauptstraße 1a, 10115 Berlin'"));
    await addBuilding(carla, "Ringweg 7, 04109 Leipzig");

    expect(await listAddresses(anna)).toEqual(["Hauptstraße 1a, 10115 Berlin", "Ringweg 7, 04109 Leipzig"]);
  });

  it("cannot be read, changed, deleted or planted by another Organisation", async () => {
    await addBuilding(anna, "Hauptstraße 1, 10115 Berlin");
    const annasOrganisationId = await db.organisationIdOf(anna);

    await attempt(db.asUser(ben, (tx) => tx.query("update buildings set address = 'Gekapert'")));
    await attempt(db.asUser(ben, (tx) => tx.query("delete from buildings")));
    await attempt(db.asUser(ben, (tx) =>
      tx.query("insert into buildings (organisation_id, address) values ($1, 'Untergeschoben')", [annasOrganisationId]),
    ));
    await attempt(db.asUser(ben, (tx) =>
      tx.query("update buildings set organisation_id = $1", [annasOrganisationId]),
    ));

    expect(await listAddresses(ben)).toEqual([]);
    expect(await listAddresses(anna)).toEqual(["Hauptstraße 1, 10115 Berlin"]);
  });

  it("cannot be moved to another Organisation by their own members", async () => {
    await addBuilding(anna, "Hauptstraße 1, 10115 Berlin");
    const bensOrganisationId = await db.organisationIdOf(ben);

    await attempt(db.asUser(anna, (tx) => tx.query("update buildings set organisation_id = $1", [bensOrganisationId])));

    expect(await listAddresses(anna)).toEqual(["Hauptstraße 1, 10115 Berlin"]);
    expect(await listAddresses(ben)).toEqual([]);
  });
});
