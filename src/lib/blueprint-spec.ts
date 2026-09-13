import { type Blueprint, parseBlueprintSourceSpec } from "@/lib/console_utils"

export type BlueprintSpecSummary = {
  fieldCount: number
  requiredCount: number
  searchOn: boolean
  searchFieldCount: number
  graphOn: boolean
  referenceCount: number
  literalEdgeCount: number
  embedOn: boolean
  embedFieldCount: number
  embedHandler: string
  indexOn: boolean
  indexParts: number
  version: string
}

export function blueprintFlagOn(raw: unknown, defaultOn = true): boolean {
  if (raw === undefined) return defaultOn
  if (typeof raw === "boolean") return raw
  if (typeof raw === "string") {
    return !["false", "0", "no", "off"].includes(raw.trim().toLowerCase())
  }
  return Boolean(raw)
}

export function positiveLevel(value: unknown, options?: { allowBoolean?: boolean }): number {
  const allowBoolean = options?.allowBoolean === true
  if (value == null) return 0
  if (typeof value === "boolean") return allowBoolean && value ? 1 : 0
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value
  if (typeof value === "string") {
    const text = value.trim().toLowerCase()
    if (allowBoolean && ["true", "yes", "y", "on"].includes(text)) return 1
    if (/^\d+$/.test(text)) {
      const number = Number(text)
      return number > 0 ? number : 0
    }
  }
  return 0
}

export function fieldIsLiteralEdge(field: { literal_edge?: unknown } | undefined): boolean {
  const raw = field?.literal_edge
  if (raw === true) return true
  if (typeof raw === "string") {
    return ["1", "true", "yes", "y", "on"].includes(raw.trim().toLowerCase())
  }
  return false
}

export function fieldGraphRole(
  field: { source?: unknown; literal_edge?: unknown } | undefined,
): "reference" | "literal" | null {
  if (!field) return null
  if (parseBlueprintSourceSpec(field.source)) return "reference"
  if (fieldIsLiteralEdge(field)) return "literal"
  return null
}

export function fieldIsSearchable(
  field: { search?: unknown } | undefined,
  blueprint?: Blueprint | null,
): boolean {
  if (!field || !blueprintFlagOn(blueprint?.enable_search, true)) return false
  return positiveLevel(field.search) > 0
}

export function fieldIsEmbedded(
  field: { embed?: unknown; source?: unknown; type?: string } | undefined,
  blueprint?: Blueprint | null,
): boolean {
  if (!field || !blueprintFlagOn(blueprint?.enable_embed, true)) return false
  if (parseBlueprintSourceSpec(field.source)) return false
  if (String(field.type || "").trim().toLowerCase() === "object") return false
  return positiveLevel(field.embed, { allowBoolean: true }) > 0
}

export function summarizeBlueprint(blueprint: Blueprint | null | undefined): BlueprintSpecSummary | null {
  if (!blueprint || !Array.isArray(blueprint.fields) || blueprint.fields.length === 0) {
    return null
  }

  let requiredCount = 0
  let searchFieldCount = 0
  let referenceCount = 0
  let literalEdgeCount = 0
  let embedFieldCount = 0

  for (const field of blueprint.fields) {
    if (!field || typeof field !== "object") continue
    const row = field as Record<string, unknown>
    if (row.required === true || String(row.required).toLowerCase() === "true") {
      requiredCount += 1
    }
    if (fieldIsSearchable(row, blueprint)) searchFieldCount += 1
    const graph = fieldGraphRole(row)
    if (graph === "reference") referenceCount += 1
    if (graph === "literal") literalEdgeCount += 1
    if (fieldIsEmbedded(row, blueprint)) embedFieldCount += 1
  }

  const indexParts = Array.isArray(blueprint.indexes?.path)
    ? blueprint.indexes.path.filter((entry) => String(entry || "").trim()).length
    : 0
  const graphOn =
    blueprintFlagOn(blueprint.enable_graph, true) && (referenceCount > 0 || literalEdgeCount > 0)
  const embedHandler = String(blueprint.embed_handler || "").trim()

  return {
    fieldCount: blueprint.fields.length,
    requiredCount,
    searchOn: searchFieldCount > 0,
    searchFieldCount,
    graphOn,
    referenceCount,
    literalEdgeCount,
    embedOn: embedFieldCount > 0 || embedHandler.length > 0,
    embedFieldCount,
    embedHandler,
    indexOn: indexParts > 0,
    indexParts,
    version: String(blueprint.version || "").trim(),
  }
}
