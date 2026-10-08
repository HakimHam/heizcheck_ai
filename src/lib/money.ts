const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

/** Integer cents as German euros, e.g. 123456 → "1.234,56 €". */
export const formatCents = (cents: number) => EURO.format(cents / 100)

/**
 * Euros as a German amount, rounded to the cent, e.g. 1234.5 → "1.234,50 €".
 * Throws on NaN or Infinity rather than showing "NaN €" to a property manager.
 */
export const formatEuros = (euros: number) => {
  if (!Number.isFinite(euros)) throw new RangeError(`Not a euro amount: ${euros}`)
  return EURO.format(euros)
}
