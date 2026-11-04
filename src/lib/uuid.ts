const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A malformed id in a URL is simply not found, not a database error. */
export const isUuid = (id: string) => UUID.test(id)
