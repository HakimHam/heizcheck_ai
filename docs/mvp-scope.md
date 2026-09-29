# HeizCheck MVP Scope

Terms are defined in [CONTEXT.md](../CONTEXT.md). Key decisions are in [docs/adr/](./adr/).

## Purpose

A Property Manager of rental buildings can defend every heating cost statement they send, and can back up a complaint to the Metering Provider when something is wrong. HeizCheck provides evidence-backed checking, not a guarantee of legal correctness. The UI carries a clear disclaimer.

## Scope

- **Users:** Property Managers of rental buildings (Mietverwaltung). Each Organisation has several users with equal rights and no roles.
- **Buildings:** residential only, central heating, 3 or more Units.
- **Metering Provider:** Minol. Extraction is provider-agnostic in principle but tested against Minol only.
- **Ruleset:** HeizkostenV, §556 para 3 BGB (the 12-month deadline only) and CO2KostAufG. GEG is excluded.
- **UI language:** German.

## Core flow

A Property Manager uploads a building's Statement Package from the Metering Provider, confirms the extracted figures, and receives a Check Report listing Findings, each citing the legal paragraph, the affected units and the € amount at stake.

1. **Upload:** one Statement Package (the Building Statement plus all Unit Statements for one Billing Period), plus the Dispatch Date, which defaults to today.
2. **Extract:** the AI produces Extracted Figures in a fixed schema. It never judges them (ADR 0001).
3. **Confirm:** once per package, on a single screen, with each figure shown next to where it appears in the PDF:
   - Building Statement: total costs per Cost Item, the consumption/base split in %, total area, fuel used, CO₂ emissions.
   - A table of Unit Statements: Unit, area, consumption, amount.
4. **Check:** the fixed rules run on the Confirmed Figures together with the Building Profile.
5. **Report:** an unchangeable Check Report containing one Check Result per rule (Passed / Finding raised / Not assessable, with the reason). It records the Confirmed Figures, the Building Profile and the Ruleset version it was based on, and can be exported as a PDF.

### Building Profile

Maintained by the Property Manager once per building and reused across Billing Periods. It holds at least the living area and whether §7 para 1 sentence 2 HeizkostenV (mandatory 70% consumption share) applies.

### Corrected packages

A corrected package from the Metering Provider is a new Statement Package for the same building and Billing Period. It supersedes the previous one. Both packages and both Check Reports are kept.

## Rule catalogue

| # | Rule | Source | Severity |
|---|---|---|---|
| C1 | Unit amounts add up to the building total (±€0.05 per Unit) | Consistency | Error |
| C2 | Unit areas add up to the Building Profile area | Consistency | Error |
| C3 | Billing Period is identical across the whole package | Consistency | Error |
| H1 | Heating consumption share is 50–70%, or exactly 70% if §7 para 1 sentence 2 applies per the Building Profile | §7 HeizkostenV | Error |
| H2 | Hot water consumption share is 50–70% | §8 HeizkostenV | Error |
| H3 | Every Cost Item maps to an Eligible Cost Type; unrecognised items raise a Warning | §7 para 2 HeizkostenV | Error / Warning |
| H4 | Readings estimated for more than 25% of the area mean the statement must be split by area only | §9a para 2 HeizkostenV | Error |
| H5 | Any estimated readings | §9a para 1 HeizkostenV | Warning |
| K1 | The CO₂ split between landlord and tenant matches the tier for kg CO₂/m²/year | CO2KostAufG | Error |
| K2 | CO₂ data is present in the statement at all | CO2KostAufG | Not assessable → Warning |
| B1 | Billing Period end + 12 months is after the Dispatch Date: Error if the deadline has passed, Warning if fewer than 4 weeks are left | §556 para 3 BGB | Error / Warning |

- **Eligible Cost Types:** a fixed list derived from §7 para 2 HeizkostenV, plus a mapping table from Minol's Cost Item names to that list. The AI extracts item names exactly as written; the rule does the lookup.
- **Severity:** Error means a definite breach; Warning means legally possible but needs the Property Manager's judgement. There is no informational level.

## Data protection

- EU hosting, and the LLM runs in an EU region with no training on customer data (see ADR 0003).
- A data processing agreement (AV-Vertrag) is available for every Organisation.
- PDFs and Check Reports are kept for 4 years, then deleted. That covers the 12-month objection window plus the 3-year limitation period (§195 BGB).

## Success criteria

Measured on about 5–10 real Minol Statement Packages:

- At least 95% of Extracted Figures are correct before the Property Manager confirms them.
- All deliberately planted errors are caught (one planted error per rule on a copied package).
- One Property Manager checks a real package in under 10 minutes.

## Later list

- A complaint (Reklamation) to the Metering Provider, generated from the Findings.
- WEG / condominium management, including Sign-off and the owners' meeting (ADR 0002).
- Plausibility checks against the previous year and similar Units.
- Other formal requirements, e.g. the §6a HeizkostenV monthly consumption information.
- Mixed-use and non-residential buildings.
- Other Metering Providers: ista, Techem, Brunata.
- Roles within an Organisation.
- An explanation document for Tenants.
- A legal opinion on the Legal Services Act (RDG) before launch.
