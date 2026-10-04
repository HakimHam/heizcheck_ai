// A building's packages for one Billing Period form a history: each corrected
// package supersedes the one before (see the supersession migration). The
// current package is the one nothing supersedes.

type HistoryEntry = { id: string; supersededBy: string | null; createdAt: string }

export const currentPackages = <T extends HistoryEntry>(packages: T[]): T[] =>
  packages.filter((pkg) => pkg.supersededBy === null)

/** The package that replaces `pkg`, following each correction; `pkg` itself if it is current. */
export function currentOf<T extends HistoryEntry>(packages: T[], pkg: T): T {
  return follow(new Map(packages.map((p) => [p.id, p])), pkg)
}

function follow<T extends HistoryEntry>(byId: Map<string, T>, pkg: T): T {
  let current = pkg
  // The database forbids cycles in practice; the bound just keeps a bad row from hanging.
  for (let i = 0; current.supersededBy !== null && i < byId.size; i++) {
    const next = byId.get(current.supersededBy)
    if (!next) break
    current = next
  }
  return current
}

/** All packages for `pkg`'s building and Billing Period, oldest first. */
export function historyOf<T extends HistoryEntry>(packages: T[], pkg: T): T[] {
  const byId = new Map(packages.map((p) => [p.id, p]))
  const current = follow(byId, pkg)
  return packages
    .filter((p) => follow(byId, p) === current)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
