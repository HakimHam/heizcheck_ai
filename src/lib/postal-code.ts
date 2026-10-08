// German postal codes are exactly five ASCII digits, leading zeros included
// ("01067" Dresden). JS `\d` is ASCII-only, so full-width digits don't match.
const GERMAN_POSTAL_CODE = /^\d{5}$/

/**
 * Whether `value` is a German postal code, e.g. `10115` → true, `1011` → false.
 * Doesn't trim: callers reading form input trim first.
 */
export const isValidGermanPostalCode = (value: string) => GERMAN_POSTAL_CODE.test(value)
