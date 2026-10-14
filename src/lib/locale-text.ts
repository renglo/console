/** Walk a locale tree. A missing key is undefined. An explicit value, including "", is kept. */

export function readPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function applyVars(template: string, vars?: Record<string, string>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

/**
 * String at `path` in the loaded locale. A missing key uses the fallback.
 * An explicit empty string stays empty, so a locale can hide an optional line.
 */
export function localeText(
  locale: unknown,
  fallback: unknown,
  path: string,
  vars?: Record<string, string>,
): string {
  const fromLocale = readPath(locale, path);
  if (typeof fromLocale === "string") return applyVars(fromLocale, vars);
  const fromFallback = readPath(fallback, path);
  if (typeof fromFallback === "string") return applyVars(fromFallback, vars);
  return "";
}

/** String list at `path`. An explicit array wins, including []. A missing key uses the fallback. */
export function localeList(locale: unknown, fallback: unknown, path: string): string[] {
  const chosen = readPath(locale, path);
  const source = Array.isArray(chosen) ? chosen : readPath(fallback, path);
  if (!Array.isArray(source)) return [];
  return source.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
