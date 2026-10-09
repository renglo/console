export type EntityTags = Record<string, string | string[]>;

export type TagRow = {
  id: string;
  key: string;
  value: string;
};

export function normalizeTagKey(key: string): string {
  return key.trim().toLowerCase();
}

export function tagsToRows(tags: EntityTags | undefined): TagRow[] {
  const rows: TagRow[] = [];
  for (const [key, value] of Object.entries(tags ?? {})) {
    const values = Array.isArray(value) ? value : [String(value ?? '')];
    for (const entry of values) {
      const trimmed = String(entry ?? '').trim();
      if (!trimmed) continue;
      rows.push({
        id: crypto.randomUUID(),
        key: normalizeTagKey(key),
        value: trimmed,
      });
    }
  }
  if (rows.length === 0) {
    return [{ id: crypto.randomUUID(), key: '', value: '' }];
  }
  return rows;
}

export function rowsToTags(rows: TagRow[]): Record<string, string[]> {
  const tags: Record<string, string[]> = {};
  for (const row of rows) {
    const key = normalizeTagKey(row.key);
    const value = row.value.trim();
    if (!key || !value) continue;
    if (!tags[key]) {
      tags[key] = [];
    }
    if (!tags[key].includes(value)) {
      tags[key].push(value);
    }
  }
  return tags;
}
