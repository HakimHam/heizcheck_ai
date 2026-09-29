# HeizCheck

A quality gate for German property managers: it checks the heating cost statements produced by a metering provider for a building before they are passed on to tenants.

## Language

### Parties

**Property Manager** (Hausverwaltung / Vermieter):
The party managing a rental building (Mietverwaltung) and responsible for billing heating costs to Tenants; the user of HeizCheck. Condominium management (WEG-Verwaltung) is a different setting, not covered yet.
_Avoid_: Landlord, admin, customer

**Metering Provider** (Messdienstleister):
The external company (e.g. ista, Techem, Brunata, Minol) that reads consumption meters and produces the heating cost statements on the Property Manager's behalf.
_Avoid_: Vendor, billing service, Abrechnungsdienst

**Organisation**:
One property management company using HeizCheck. All of its users have equal rights and see all of its buildings.
_Avoid_: Account, tenant (in the SaaS sense), workspace

**Tenant** (Mieter):
The occupant of a unit who ultimately receives a Unit Statement. Not a user of HeizCheck.
_Avoid_: Resident, renter

### Statements

**Statement Package** (Abrechnungspaket):
One building's Building Statement together with all of its Unit Statements for a single Billing Period. The unit that HeizCheck checks.
_Avoid_: Batch, upload, bundle

**Building Statement** (Gesamtabrechnung):
The building-wide statement listing total heating costs, the allocation split and the totals distributed across units.
_Avoid_: Master statement, summary

**Unit Statement** (Einzelabrechnung):
The statement assigning one unit's share of the building's heating costs.
_Avoid_: Tenant statement, individual bill

**Cost Item** (Kostenposition):
One cost line in a Building Statement, named as the Metering Provider wrote it.
_Avoid_: Cost line, position, charge

**Eligible Cost Type** (umlagefähige Kostenart):
One of the fixed cost categories that §7 para 2 HeizkostenV allows to be passed on to Tenants. Every Cost Item either maps to one or is unrecognised.
_Avoid_: Allowed cost, billable cost

**Unit** (Nutzeinheit):
A separately billed part of a building, usually an apartment, that receives one Unit Statement.
_Avoid_: Apartment, flat, Wohnung

**Superseded Package**:
A Statement Package replaced by a corrected one from the Metering Provider for the same building and Billing Period. It and its Check Report are kept, not deleted.
_Avoid_: Old version, deleted package

**Dispatch Date** (Versanddatum):
The date the Property Manager sends, or plans to send, the Unit Statements to Tenants; used for the §556 para 3 BGB deadline.
_Avoid_: Send date, delivery date

**Billing Period** (Abrechnungszeitraum):
The period, usually twelve months, that a Statement Package covers.
_Avoid_: Year, cycle

**Building Profile** (Gebäudeprofil):
Facts about a building that the Metering Provider does not supply but the Ruleset needs, such as living area and whether a 70% consumption share is mandatory. Maintained by the Property Manager and reused across Billing Periods.
_Avoid_: Building settings, property data

### Checking

**Extracted Figures**:
The figures the AI has read from a Statement Package's PDFs, before the Property Manager has confirmed them.
_Avoid_: Parsed data, raw data

**Confirmed Figures**:
Extracted Figures the Property Manager has confirmed, once per Statement Package. They are the only input the rules use.
_Avoid_: Verified data, approved figures

**Check Report** (Prüfbericht):
The single output of checking one Statement Package: one Check Result for every rule in the Ruleset. Immutable once created: it records the Confirmed Figures, the Building Profile and the Ruleset version it was based on.
_Avoid_: Audit, result, analysis

**Finding** (Befund):
One issue in a Statement Package, with a Severity, its legal reference, the affected unit(s) and the € amount at stake where it can be quantified.
_Avoid_: Issue, flag, problem

**Check Result** (Prüfergebnis):
The outcome of applying one rule to a Statement Package: Passed, Finding raised, or Not assessable (with the reason, e.g. missing Building Profile data).
_Avoid_: Status, outcome

**Severity** (Schweregrad):
How serious a Finding is: either **Error** (Fehler), a definite breach, or **Warning** (Prüfhinweis), legally possible but requiring the Property Manager's judgement. There is no informational level.
_Avoid_: Priority, level, info

### Rules

**Ruleset**:
The legal basis HeizCheck checks against: HeizkostenV, §556 para 3 BGB (the 12-month deadline only) and CO2KostAufG. GEG is explicitly not part of it.
_Avoid_: Regulations, compliance rules
