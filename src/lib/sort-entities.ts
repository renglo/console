/** Sort entity-like records alphabetically by display name (case-insensitive). */
export function sortByName<T extends { name?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }),
  );
}
