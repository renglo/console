export type EntityPreferences = Record<string, string>;

export type PreferenceRow = {
  id: string;
  key: string;
  value: string;
};

export function normalizePreferenceKey(key: string): string {
  return key.trim().toLowerCase();
}

export function preferencesToRows(preferences: EntityPreferences | undefined): PreferenceRow[] {
  const rows: PreferenceRow[] = [];
  for (const [key, value] of Object.entries(preferences ?? {})) {
    if (value == null || typeof value === 'object') continue;
    const trimmed = String(value).trim();
    if (!trimmed) continue;
    rows.push({
      id: crypto.randomUUID(),
      key: normalizePreferenceKey(key),
      value: trimmed,
    });
  }
  if (rows.length === 0) {
    return [{ id: crypto.randomUUID(), key: '', value: '' }];
  }
  return rows;
}

/** One value per key. A repeated key keeps the last non-empty row. */
export function rowsToPreferences(rows: PreferenceRow[]): Record<string, string> {
  const preferences: Record<string, string> = {};
  for (const row of rows) {
    const key = normalizePreferenceKey(row.key);
    const value = row.value.trim();
    if (!key || !value) continue;
    preferences[key] = value;
  }
  return preferences;
}
