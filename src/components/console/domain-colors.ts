import * as d3 from "d3";

export const DOMAIN_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#ca8a04",
  "#db2777",
  "#4f46e5",
  "#0d9488",
  "#64748b",
];

export type DomainColorDictionary = Record<string, string>;

export function normalizeDomainKey(domain: string): string {
  const aliases: Record<string, string> = { secrets: "secret", tag: "governance" };
  const normalized = String(domain ?? "other").trim().toLowerCase();
  return aliases[normalized] ?? normalized;
}

export function parseDomainColorDictionary(raw: unknown): DomainColorDictionary {
  let source: unknown = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "_") {
      return {};
    }
    try {
      source = JSON.parse(trimmed);
    } catch {
      return {};
    }
  }

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {};
  }

  const parsed: DomainColorDictionary = {};
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const normalizedKey = normalizeDomainKey(key);
    const color = String(value ?? "").trim();
    if (normalizedKey && /^#[0-9A-Fa-f]{6}$/.test(color)) {
      parsed[normalizedKey] = color;
    }
  }
  return parsed;
}

export function createDomainColorScale(
  domains: string[],
  domainColors?: DomainColorDictionary,
) {
  const configured = domainColors ?? {};
  const normalizedDomains = [...new Set(domains.map(normalizeDomainKey))].sort();
  const unknownDomains = normalizedDomains.filter((domain) => !configured[domain]);
  const fallback = d3
    .scaleOrdinal<string, string>()
    .domain(unknownDomains)
    .range(DOMAIN_COLORS);

  return (domain: string) => {
    const key = normalizeDomainKey(domain);
    return configured[key] ?? fallback(key) ?? DOMAIN_COLORS[0];
  };
}
