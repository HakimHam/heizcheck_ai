import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attempt, createTestDatabase, type TestDatabase } from "./test-database";

let db: TestDatabase;
let anna: string;
let ben: string;
let buildingId: string;

beforeEach(async () => {
  db = await createTestDatabase();
  anna = await db.signUp({ email: "anna@verwaltung-a.de", organisationName: "Verwaltung A" });
  ben = await db.signUp({ email: "ben@verwaltung-b.de", organisationName: "Verwaltung B" });
  buildingId = await db.asUser(anna, async (tx) =>
    (await tx.query<{ id: string }>(
      "insert into buildings (address, residential) values ('Hauptstraße 1, 10115 Berlin', true) returning id",
    )).rows[0].id,
  );
});

afterEach(async () => {
  await db.close();
});

type ProfileRow = {
  living_area_m2: string | null;
  heated_area_m2: string | null;
  mandatory_70_pct: boolean | null;
  residential: boolean;
  co2_reduction: string | null;
};

const readProfile = (userId: string) =>
  db.asUser(userId, async (tx) =>
    (await tx.query<ProfileRow>(
      `select living_area_m2::text, heated_area_m2::text, mandatory_70_pct, residential, co2_reduction
         from buildings where id = $1`,
      [buildingId],
    )).rows[0],
  );

const setProfile = (userId: string, assignments: string, params: unknown[] = []) =>
  db.asUser(userId, (tx) => tx.query(`update buildings set ${assignments} where id = $1`, [buildingId, ...params]));

describe("the Building Profile", () => {
  it("starts unknown rather than filled with defaults, so rules can report Not assessable", async () => {
    expect(await readProfile(anna)).toEqual({
      living_area_m2: null,
      heated_area_m2: null,
      mandatory_70_pct: null,
      residential: true,
      co2_reduction: null,
    });
  });

  it("stores every fact the Property Manager records", async () => {
    await setProfile(
      anna,
      "living_area_m2 = $2, heated_area_m2 = $3, mandatory_70_pct = false, residential = false, co2_reduction = 'heritage'",
      ["612.40", "598.75"],
    );

    expect(await readProfile(anna)).toEqual({
      living_area_m2: "612.40",
      heated_area_m2: "598.75",
      mandatory_70_pct: false,
      residential: false,
      co2_reduction: "heritage",
    });
  });

  it("can be set back to unknown", async () => {
    await setProfile(anna, "living_area_m2 = 600, heated_area_m2 = 590, mandatory_70_pct = true, co2_reduction = 'none'");
    await setProfile(anna, "living_area_m2 = null, heated_area_m2 = null, mandatory_70_pct = null, co2_reduction = null");

    expect(await readProfile(anna)).toMatchObject({
      living_area_m2: null,
      heated_area_m2: null,
      mandatory_70_pct: null,
      co2_reduction: null,
    });
  });

  it("accepts each §9 CO2KostAufG reduction case", async () => {
    for (const reduction of ["none", "heritage", "district_heating"]) {
      await setProfile(anna, "co2_reduction = $2", [reduction]);
      expect((await readProfile(anna)).co2_reduction).toBe(reduction);
    }
  });

  it("refuses an unknown reduction case", async () => {
    await expect(setProfile(anna, "co2_reduction = 'solar'")).rejects.toThrow();
  });

  it("refuses areas that are zero or negative", async () => {
    await expect(setProfile(anna, "living_area_m2 = 0")).rejects.toThrow();
    await expect(setProfile(anna, "heated_area_m2 = -12.5")).rejects.toThrow();
  });

  it("requires a building to be recorded as residential or not", async () => {
    await expect(
      db.asUser(anna, (tx) => tx.query("insert into buildings (address) values ('Ringweg 7, 04109 Leipzig')")),
    ).rejects.toThrow();
    await expect(setProfile(anna, "residential = null")).rejects.toThrow();
  });

  it("cannot be read or changed by another Organisation", async () => {
    await attempt(setProfile(ben, "living_area_m2 = 1, residential = false"));

    expect(await readProfile(ben)).toBeUndefined();
    expect(await readProfile(anna)).toMatchObject({ living_area_m2: null, residential: true });
  });
});
