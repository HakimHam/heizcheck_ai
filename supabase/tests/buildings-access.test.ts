import { beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "./test-database";

type Db = Awaited<ReturnType<typeof createTestDatabase>>;

describe("Buildings access", () => {
  let db: Db;
  let anna: string;
  let ben: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    anna = await db.signUp("anna@hv-mueller.de", { organisation_name: "HV Müller" });
    ben = await db.signUp("ben@hv-schmidt.de", { organisation_name: "HV Schmidt" });
  });

  it("starts with an empty buildings list", async () => {
    expect(await db.as(anna, "select * from buildings")).toEqual([]);
  });

  it("files a new building under the user's own Organisation", async () => {
    await db.as(anna, "insert into buildings (address) values ('Lindenstraße 5, 10115 Berlin')");

    const buildings = await db.as<{ address: string }>(anna, "select address from buildings");

    expect(buildings).toEqual([{ address: "Lindenstraße 5, 10115 Berlin" }]);
  });

  it("hides another Organisation's buildings", async () => {
    await db.as(ben, "insert into buildings (address) values ('Hafenweg 1, 20457 Hamburg')");

    expect(await db.as(anna, "select * from buildings")).toEqual([]);
  });

  it("lets every member of an Organisation see the same buildings", async () => {
    const carla = await db.signUp("carla@hv-mueller.de", { organisation_name: "Temporär" });
    await db.admin(
      "update organisation_members set organisation_id = (select organisation_id from organisation_members where user_id = $1) where user_id = $2",
      [anna, carla],
    );
    await db.as(anna, "insert into buildings (address) values ('Lindenstraße 5, 10115 Berlin')");

    const buildings = await db.as<{ address: string }>(carla, "select address from buildings");

    expect(buildings).toEqual([{ address: "Lindenstraße 5, 10115 Berlin" }]);
  });

  it("refuses to file a building under another Organisation", async () => {
    const [{ organisation_id: schmidt }] = await db.admin<{ organisation_id: string }>(
      "select organisation_id from organisation_members where user_id = $1",
      [ben],
    );

    await expect(
      db.as(anna, "insert into buildings (organisation_id, address) values ($1, 'Hafenweg 1')", [schmidt]),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not let a user change or delete another Organisation's building", async () => {
    await db.as(ben, "insert into buildings (address) values ('Hafenweg 1, 20457 Hamburg')");

    await db.as(anna, "update buildings set address = 'gekapert'");
    await db.as(anna, "delete from buildings");

    const buildings = await db.as<{ address: string }>(ben, "select address from buildings");
    expect(buildings).toEqual([{ address: "Hafenweg 1, 20457 Hamburg" }]);
  });

  it("shows nothing to a visitor who isn't signed in", async () => {
    await db.as(anna, "insert into buildings (address) values ('Lindenstraße 5, 10115 Berlin')");

    await expect(db.asAnonymous("select * from buildings")).rejects.toThrow(/permission denied/);
  });
});
