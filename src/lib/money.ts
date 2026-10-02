const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

/** Integer cents as German euros, e.g. 123456 → "1.234,56 €". */
export const formatCents = (cents: number) => EURO.format(cents / 100)
