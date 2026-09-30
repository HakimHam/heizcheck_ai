import { describe, expect, it } from "vitest";
import { formatArea, parseBuildingForm, toFormValues } from "./building-form";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  const defaults = {
    address: "Hauptstraße 1, 10115 Berlin",
    livingArea: "",
    heatedArea: "",
    mandatory70Pct: "",
    residential: "true",
    co2Reduction: "",
  };
  for (const [name, value] of Object.entries({ ...defaults, ...fields })) data.set(name, value);
  return data;
};

describe("parseBuildingForm", () => {
  it("keeps every fact left blank as unknown", () => {
    expect(parseBuildingForm(form({}))).toEqual({
      ok: true,
      building: {
        address: "Hauptstraße 1, 10115 Berlin",
        profile: {
          livingAreaM2: null,
          heatedAreaM2: null,
          mandatory70Pct: null,
          residential: true,
          co2Reduction: null,
        },
      },
    });
  });

  it("reads every recorded fact", () => {
    const result = parseBuildingForm(
      form({
        address: "  Ringweg 7, 04109 Leipzig ",
        livingArea: "612,4",
        heatedArea: "598,75",
        mandatory70Pct: "false",
        residential: "false",
        co2Reduction: "district_heating",
      }),
    );

    expect(result).toEqual({
      ok: true,
      building: {
        address: "Ringweg 7, 04109 Leipzig",
        profile: {
          livingAreaM2: 612.4,
          heatedAreaM2: 598.75,
          mandatory70Pct: false,
          residential: false,
          co2Reduction: "district_heating",
        },
      },
    });
  });

  it.each([
    ["612", 612],
    ["612,5", 612.5],
    ["612.5", 612.5],
    ["1.234,56", 1234.56],
    ["1.234", 1234],
    [" 1 234,5 ", 1234.5],
  ])("reads the area %j as %d m²", (input, expected) => {
    const result = parseBuildingForm(form({ livingArea: input }));
    expect(result.ok && result.building.profile.livingAreaM2).toBe(expected);
  });

  it.each(["0", "-5", "abc", "12,345", "1,2,3", "12.34.5"])("refuses the area %j", (input) => {
    expect(parseBuildingForm(form({ heatedArea: input }))).toEqual({
      ok: false,
      errors: { heatedArea: expect.any(String) },
    });
  });

  it("requires an address", () => {
    expect(parseBuildingForm(form({ address: "   " }))).toEqual({
      ok: false,
      errors: { address: expect.any(String) },
    });
  });

  it("requires residential to be answered yes or no", () => {
    expect(parseBuildingForm(form({ residential: "" }))).toEqual({
      ok: false,
      errors: { residential: expect.any(String) },
    });
  });

  it("refuses choices the form doesn't offer", () => {
    expect(parseBuildingForm(form({ mandatory70Pct: "vielleicht", co2Reduction: "solar" }))).toEqual({
      ok: false,
      errors: { mandatory70Pct: expect.any(String), co2Reduction: expect.any(String) },
    });
  });
});

describe("formatArea", () => {
  it("writes areas the way a German form expects them back", () => {
    expect(formatArea(612.4)).toBe("612,4");
    expect(formatArea(1234.56)).toBe("1234,56");
    expect(formatArea(600)).toBe("600");
    expect(formatArea(null)).toBe("");
  });
});

describe("toFormValues", () => {
  it("offers a new building's form blank, with every fact unknown", () => {
    expect(toFormValues(null)).toEqual({
      address: "",
      livingArea: "",
      heatedArea: "",
      mandatory70Pct: "",
      residential: "",
      co2Reduction: "",
    });
  });

  it("round-trips a saved building through the form", () => {
    const building = {
      address: "Ringweg 7, 04109 Leipzig",
      profile: {
        livingAreaM2: 1234.5,
        heatedAreaM2: null,
        mandatory70Pct: false,
        residential: true,
        co2Reduction: "heritage" as const,
      },
    };
    const data = new FormData();
    for (const [name, value] of Object.entries(toFormValues(building))) data.set(name, value);

    expect(toFormValues(building)).toMatchObject({ livingArea: "1234,5", heatedArea: "", mandatory70Pct: "false" });
    expect(parseBuildingForm(data)).toEqual({ ok: true, building });
  });
});
