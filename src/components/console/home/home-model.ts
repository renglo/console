import { orgInstallableIds, portfolioCatalog } from '@/lib/auth-tree';
import { orgThumbnailUrl } from '@/lib/image-upload';
import { orgOpenPath } from '@/lib/resolve-preferences';
import { PORTFOLIO_SCOPE_ORG, PORTFOLIO_SCOPE_ORG_LABEL, sortByName } from '@/lib/sort-entities';

import type { HomeOrg, HomePortfolio, HomeTag } from './types';

type RawOrg = {
  name?: string;
  org_id: string;
  active?: boolean;
  handle?: string;
  tools?: string[];
  extensions?: string[];
  tags?: Record<string, string | string[] | null | undefined>;
  preferences?: Record<string, string>;
};

const TAG_KEY_ORDER = ['director', 'studio', 'year'];

function orgTags(tags: RawOrg['tags']): HomeTag[] {
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) return [];

  const grouped = new Map<string, string[]>();
  for (const [rawKey, rawValue] of Object.entries(tags)) {
    const key = rawKey.trim().toLowerCase();
    if (!key) continue;
    const values = (Array.isArray(rawValue) ? rawValue : [rawValue])
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), ...values]);
  }

  const rest = [...grouped.keys()]
    .filter((key) => !TAG_KEY_ORDER.includes(key))
    .sort((a, b) => a.localeCompare(b));
  const keys = [...TAG_KEY_ORDER.filter((key) => grouped.has(key)), ...rest];
  return keys.flatMap((key) => (grouped.get(key) ?? []).map((value) => ({ key, value })));
}

export type AuthTreePortfolios = Record<string, RawPortfolio>;

type RawPortfolio = {
  name?: string;
  portfolio_id: string;
  about?: string;
  preferences?: Record<string, string>;
  teams?: Record<string, { name?: string; preferences?: Record<string, string> }>;
  orgs?: Record<string, RawOrg>;
  tools?: Record<string, { name?: string; handle?: string }>;
  extensions?: Record<string, { name?: string; handle?: string }>;
};

function displayName(org: RawOrg): string {
  if (org.org_id === PORTFOLIO_SCOPE_ORG) return PORTFOLIO_SCOPE_ORG_LABEL;
  return org.name || org.handle || org.org_id;
}

export function homePortfoliosFromTree(
  portfolios: Record<string, RawPortfolio> | undefined,
  userPreferences?: Record<string, string>,
): HomePortfolio[] {
  if (!portfolios) return [];

  return sortByName(Object.values(portfolios))
    .map((portfolio) => {
      const catalog = portfolioCatalog(portfolio);
      const orgs: HomeOrg[] = sortByName(
        Object.values(portfolio.orgs || {}).filter((org) => org.active === true),
      ).map((org) => {
        const isScope = org.org_id === PORTFOLIO_SCOPE_ORG;
        const extensions = sortByName(
          orgInstallableIds(org).map((id) => ({
            id,
            name: catalog[id]?.name || id,
            handle: String(catalog[id]?.handle || ''),
          })),
        );
        const thumbnailTarget = orgOpenPath(
          portfolio.portfolio_id,
          org.org_id,
          extensions,
          {
            teams: portfolio.teams,
            org: org.preferences,
            portfolio: portfolio.preferences,
            user: userPreferences,
          },
        );

        return {
          orgId: org.org_id,
          name: displayName(org),
          handle: org.handle || '',
          imageSrc: isScope
            ? '/icons/Asterisk.svg'
            : orgThumbnailUrl(portfolio.portfolio_id, org.org_id),
          isScope,
          tags: orgTags(org.tags),
          extensions,
          thumbnailTarget,
        };
      });

      const about = typeof portfolio.about === 'string' ? portfolio.about.trim() : '';

      return {
        id: portfolio.portfolio_id,
        name: portfolio.name || portfolio.portfolio_id,
        about,
        orgs,
      };
    })
    .filter((portfolio) => portfolio.orgs.length > 0);
}

export function projectCount(count: number): string {
  return `${count} ${count === 1 ? 'entity' : 'entities'}`;
}
