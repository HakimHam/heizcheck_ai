// The Eligible Cost Types and the Minol mapping H3 looks Cost Items up in. Both
// are part of the Ruleset: changing either means bumping RULESET_VERSION.

/** The cost categories §7 Abs. 2 HeizkostenV allows to be passed on to Tenants. */
export const ELIGIBLE_COST_TYPES = {
  fuel: 'Brennstoffe und ihre Lieferung',
  operating_power: 'Betriebsstrom',
  operation: 'Bedienung, Überwachung und Pflege der Anlage',
  testing: 'Prüfung der Betriebsbereitschaft und Betriebssicherheit einschließlich der Einstellung durch eine Fachkraft',
  cleaning: 'Reinigung der Anlage einschließlich der Abgasanlage und des Betriebsraums',
  emission_measurement: 'Messungen nach dem Bundes-Immissionsschutzgesetz',
  metering_rental: 'Anmietung oder andere Art der Gebrauchsüberlassung einer Ausstattung zur Verbrauchserfassung',
  metering_use:
    'Verwendung einer Ausstattung zur Verbrauchserfassung einschließlich Eichung, Berechnung, Aufteilung und Verbrauchsanalyse',
  consumption_information: 'Bereitstellung der Abrechnungs- und Verbrauchsinformationen nach §6a HeizkostenV',
} as const
export type EligibleCostType = keyof typeof ELIGIBLE_COST_TYPES

export const NOT_ELIGIBLE = 'not_eligible'

/**
 * Minol's Cost Item names, written as Minol prints them, and what each maps to.
 * District heating (Fernwärme, Wärmelieferung) falls under §7 Abs. 4, not
 * Abs. 2, so it is deliberately left out and raises a Warning.
 */
export const MINOL_COST_ITEMS: Record<string, EligibleCostType | typeof NOT_ELIGIBLE> = {
  Brennstoffkosten: 'fuel',
  'Brennstoffkosten Erdgas': 'fuel',
  'Brennstoffkosten Heizöl': 'fuel',
  Erdgas: 'fuel',
  Heizöl: 'fuel',
  Brennstofflieferung: 'fuel',
  Betriebsstrom: 'operating_power',
  'Strom für Heizung': 'operating_power',
  Bedienung: 'operation',
  'Bedienung und Überwachung': 'operation',
  Wartung: 'testing',
  Heizungswartung: 'testing',
  'Wartung Heizungsanlage': 'testing',
  'Einstellung durch Fachkraft': 'testing',
  Reinigung: 'cleaning',
  'Reinigung Heizungsanlage': 'cleaning',
  'Reinigung Heizraum': 'cleaning',
  Tankreinigung: 'cleaning',
  Immissionsmessung: 'emission_measurement',
  Schornsteinfeger: 'emission_measurement',
  Schornsteinfegerkosten: 'emission_measurement',
  Emissionsmessung: 'emission_measurement',
  Gerätemiete: 'metering_rental',
  'Miete Erfassungsgeräte': 'metering_rental',
  'Miete Heizkostenverteiler': 'metering_rental',
  'Miete Wärmezähler': 'metering_rental',
  'Miete Warmwasserzähler': 'metering_rental',
  Verbrauchsabrechnung: 'metering_use',
  'Verbrauchsabrechnung Minol': 'metering_use',
  'Kosten der Verbrauchsabrechnung': 'metering_use',
  Abrechnungskosten: 'metering_use',
  Eichkosten: 'metering_use',
  Eichung: 'metering_use',
  Verbrauchsanalyse: 'metering_use',
  'Unterjährige Verbrauchsinformation': 'consumption_information',
  Verbrauchsinformation: 'consumption_information',
  Reparatur: NOT_ELIGIBLE,
  Reparaturkosten: NOT_ELIGIBLE,
  Instandsetzung: NOT_ELIGIBLE,
  'Instandsetzung Heizungsanlage': NOT_ELIGIBLE,
  Instandhaltung: NOT_ELIGIBLE,
  Kesseltausch: NOT_ELIGIBLE,
  Verwaltungskosten: NOT_ELIGIBLE,
  Mahngebühren: NOT_ELIGIBLE,
  Nutzerwechselgebühr: NOT_ELIGIBLE,
  Zwischenablesung: NOT_ELIGIBLE,
}

/** Two names match when they differ only in whitespace and case. */
export const normaliseCostItemName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')

const BY_NORMALISED_NAME = new Map(
  Object.entries(MINOL_COST_ITEMS).map(([name, type]) => [normaliseCostItemName(name), type]),
)

/** What a Cost Item maps to, or undefined when the name isn't in the table. */
export const lookUpCostItem = (name: string) => BY_NORMALISED_NAME.get(normaliseCostItemName(name))
