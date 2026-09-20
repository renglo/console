/** Auth-tree helpers for the tool / extension coexistence window. */

/** Fields read from portfolio catalog entries. No index signature so local Tool types assign. */
type CatalogSourceDoc = {
  name?: string;
  handle?: string;
  tool_id?: string;
  extension_id?: string;
  entity_type?: string;
  roles?: string[];
};

export type InstallableDoc = CatalogSourceDoc & {
  [key: string]: unknown;
};

type PortfolioNode = {
  tools?: Record<string, CatalogSourceDoc>;
  extensions?: Record<string, CatalogSourceDoc>;
};

type OrgNode = {
  tools?: string[];
  extensions?: string[];
};

type TeamAccess = {
  orgs?: string[];
  roles?: string[];
};

type TeamNode = {
  tools?: Record<string, TeamAccess>;
  extensions?: Record<string, TeamAccess>;
};

export function portfolioCatalog(
  portfolio: PortfolioNode | undefined,
): Record<string, InstallableDoc> {
  const catalog: Record<string, InstallableDoc> = {};
  for (const [id, doc] of Object.entries(portfolio?.tools || {})) {
    catalog[id] = { ...doc, entity_type: doc.entity_type || "tool" };
  }
  for (const [id, doc] of Object.entries(portfolio?.extensions || {})) {
    catalog[id] = { ...doc, entity_type: doc.entity_type || "extension" };
  }
  return catalog;
}

export function orgInstallableIds(org: OrgNode | undefined): string[] {
  return [...new Set([...(org?.tools || []), ...(org?.extensions || [])])];
}

export function installableId(doc: InstallableDoc | undefined): string {
  return String(doc?.extension_id || doc?.tool_id || "").trim();
}

export function teamInstallableAccess(
  team: TeamNode | undefined,
  entityId: string,
): TeamAccess {
  if (!team || !entityId) {
    return {};
  }
  return team.extensions?.[entityId] || team.tools?.[entityId] || {};
}
