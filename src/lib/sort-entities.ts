/** Sort entity-like records alphabetically by display name (case-insensitive). */
export function sortByName<T extends { name?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }),
  );
}

/** Portfolio-scoped pseudo-org id (team/tool:org grants, cross-org config rings). */
export const PORTFOLIO_SCOPE_ORG = '_all';

/** Display label for {@link PORTFOLIO_SCOPE_ORG} everywhere in the UI. */
export const PORTFOLIO_SCOPE_ORG_LABEL = 'ALL';

/** Org list for settings tables: portfolio scope first, then alphabetical. */
export function sortOrgsForAccess<T extends { org_id: string; name?: string | null }>(
  orgs: T[],
): T[] {
  return [...orgs].sort((a, b) => {
    if (a.org_id === PORTFOLIO_SCOPE_ORG) return -1;
    if (b.org_id === PORTFOLIO_SCOPE_ORG) return 1;
    return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });
  });
}

/** Settings/extensions matrix always includes the portfolio-scoped pseudo-org. */
export function orgsForExtensionAccess<
  T extends { org_id: string; name?: string | null; handle?: string },
>(orgsdict: Record<string, T> | undefined | null): T[] {
  const orgs = Object.values(orgsdict || {});
  if (!orgs.some((org) => org.org_id === PORTFOLIO_SCOPE_ORG)) {
    orgs.push({
      org_id: PORTFOLIO_SCOPE_ORG,
      name: PORTFOLIO_SCOPE_ORG_LABEL,
      handle: PORTFOLIO_SCOPE_ORG,
    } as T);
  }
  return sortOrgsForAccess(orgs);
}
