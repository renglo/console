import { normalizePreferenceKey } from '@/lib/entity-preferences';
import { sortByName } from '@/lib/sort-entities';

/** Platform preference: extension handle to open for an org (immutable handle, not id). */
export const PREFERENCE_DEFAULT_EXTENSION = 'default_extension';

export function preferenceValue(
  map: Record<string, string> | undefined,
  key: string,
): string | undefined {
  if (!map) return undefined;
  const normalized = normalizePreferenceKey(key);
  const raw = map[normalized] ?? map[key];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

/**
 * Resolve `default_extension` for opening an org from the home page.
 * Order: signed-in user, team (alphabetical by name), org, portfolio.
 */
export function resolveDefaultExtensionHandle(context: {
  teams?: Record<string, { name?: string; preferences?: Record<string, string> }>;
  org?: Record<string, string>;
  portfolio?: Record<string, string>;
  user?: Record<string, string>;
}): string | undefined {
  const fromUser = preferenceValue(context.user, PREFERENCE_DEFAULT_EXTENSION);
  if (fromUser) return fromUser;

  for (const team of sortByName(Object.values(context.teams ?? {}))) {
    const fromTeam = preferenceValue(team.preferences, PREFERENCE_DEFAULT_EXTENSION);
    if (fromTeam) return fromTeam;
  }

  return (
    preferenceValue(context.org, PREFERENCE_DEFAULT_EXTENSION) ??
    preferenceValue(context.portfolio, PREFERENCE_DEFAULT_EXTENSION)
  );
}

export type ExtensionHandleRef = {
  id: string;
  handle: string;
};

/** Match a preference value to an installable granted on the org (by handle, then id). */
export function matchExtensionRef(
  extensions: ExtensionHandleRef[],
  preferred: string,
): ExtensionHandleRef | undefined {
  const needle = preferred.trim().toLowerCase();
  if (!needle) return undefined;
  return (
    extensions.find((ext) => ext.handle.trim().toLowerCase() === needle) ??
    extensions.find((ext) => ext.id.trim().toLowerCase() === needle)
  );
}

/** Route segment for the tool router (handle when set). */
export function extensionRouteSegment(ext: ExtensionHandleRef): string {
  const handle = ext.handle.trim();
  return handle || ext.id;
}

export function orgOpenPath(
  portfolioId: string,
  orgId: string,
  extensions: ExtensionHandleRef[],
  context: Parameters<typeof resolveDefaultExtensionHandle>[0],
): string | null {
  if (extensions.length === 0) return null;

  const preferred = resolveDefaultExtensionHandle(context);
  const target =
    (preferred ? matchExtensionRef(extensions, preferred) : undefined) ?? extensions[0];

  return `/${portfolioId}/${orgId}/${extensionRouteSegment(target)}`;
}
