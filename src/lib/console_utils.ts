// Define the type for a single field object (based on the blueprint fields)
interface Field {
    name: string;
    type: string;
    widget: string;
    options?: { [key: string]: string }; // Optional options field for enum-like types
    cardinality: string;
    default: string;
    hint: string;
    id: string;
    label: string;
    /** Depth / visibility tier; 0 = list + primary UI. API may send string. */
    layer?: number | string;
    /** Some blueprints use `level` instead of `layer` (same meaning). */
    level?: number | string;
    multilingual: boolean;
    order: number;
    required: boolean;
    semantic: string;
    source?: unknown;
  }

export interface BlueprintSourceSpec {
    target: string;
    targetLabelFields: string[];
    edgeType?: string;
    qualifiers: string[];
    dynamic: boolean;
}

export function readReferenceValue(entry: unknown): string | null {
    if (entry === null || entry === undefined) return null;
    if (typeof entry === "object" && !Array.isArray(entry)) {
        const ref = entry as Record<string, unknown>;
        const direct =
            ref.value ??
            ref.id ??
            ref._id ??
            (typeof ref.target === "object" && ref.target !== null
                ? (ref.target as Record<string, unknown>).id ??
                  (ref.target as Record<string, unknown>)._id ??
                  (ref.target as Record<string, unknown>).value
                : undefined);
        if (direct === null || direct === undefined) return null;
        const text = String(direct).trim();
        return text || null;
    }
    const text = String(entry).trim();
    return text || null;
}

export function parseBlueprintSourceSpec(source: unknown): BlueprintSourceSpec | null {
    if (typeof source === "string") {
        const trimmed = source.trim();
        if (!trimmed) return null;

        // Legacy colon format is supported:
        // "<target_blueprint>:<deprecated_target_key>:<preview_fields>"
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            const parts = trimmed.split(":").map((p) => p.trim());
            if (parts.length !== 3 || !parts[0]) return null;
            const labelFields = parts[2]
                .split(",")
                .map((token) => token.trim())
                .filter(Boolean);
            return {
                target: parts[0],
                targetLabelFields: labelFields,
                qualifiers: [],
                dynamic: false,
            };
        }

        try {
            const parsed = JSON.parse(trimmed);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                return null;
            }
            source = parsed;
        } catch {
            // Legacy non-JSON string formats are intentionally unsupported.
            return null;
        }
    }

    if (!source || typeof source !== "object" || Array.isArray(source)) {
        return null;
    }
    const raw = source as Record<string, unknown>;
    const target = typeof raw.target === "string" ? raw.target.trim() : "";
    if (!target) return null;

    const rawLabel = raw.preview;
    const targetLabelFields = Array.isArray(rawLabel)
        ? rawLabel.map((token) => String(token).trim()).filter(Boolean)
        : typeof rawLabel === "string"
            ? rawLabel.split(",").map((token) => token.trim()).filter(Boolean)
            : [];
    const qualifiers = Array.isArray(raw.qualifiers)
        ? raw.qualifiers.map((token) => String(token).trim()).filter(Boolean)
        : [];
    const edgeType = typeof raw.type === "string" && raw.type.trim() ? raw.type.trim() : undefined;
    return {
        target,
        targetLabelFields,
        edgeType,
        qualifiers,
        dynamic: Boolean(raw.dynamic),
    };
}

/** Numeric tier for list/detail visibility: table shows fields with tier ≤ 0. */
export function fieldLayer(field: { layer?: unknown; level?: unknown }): number {
    const raw = field.layer ?? field.level;
    if (raw === undefined || raw === null || raw === "") return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

export function isBlueprintTableField(field: { layer?: unknown; level?: unknown }): boolean {
    return fieldLayer(field) <= 0;
}

/**
 * Normalize API values that may be JSON objects/arrays or a JSON/Python-ish string.
 * Used for blueprint fields stored as textarea (e.g. hooks, slots) when the backend returns parsed JSON.
 */
export function parseStructuredFieldJson(input: unknown): unknown {
    if (input === null || input === undefined) {
        return null;
    }
    if (typeof input === "object") {
        return input;
    }
    if (typeof input !== "string") {
        return null;
    }
    const s = input.trim();
    if (!s) {
        return null;
    }
    try {
        return JSON.parse(s);
    } catch {
        try {
            const jsonString = s
                .replace(/'/g, '"')
                .replace(/True/g, "true")
                .replace(/False/g, "false")
                .replace(/None/g, "null");
            return JSON.parse(jsonString);
        } catch {
            return null;
        }
    }
}

// Declare the Blueprint interface
export interface Blueprint {
    label: string;
    fields?: Field[]; // Mark 'fields' as optional
    rich?: { [key: string]: { [key: string]: string } }; // Declare 'rich' as optional with a dynamic structure
    sources?: { [key: string]: string };
    /** Index key segments; fields listed in `path` are immutable in storage. */
    indexes?: { path?: string[] };
    [key: string]: any;
}

/** Field names that participate in `indexes.path` (immutable). */
export function getBlueprintIndexPathFieldSet(
    blueprint: Blueprint | null | undefined,
): Set<string> {
    const path = blueprint?.indexes?.path;
    if (!Array.isArray(path)) return new Set();
    const out = new Set<string>();
    for (const p of path) {
        if (typeof p === "string" && p.length > 0) out.add(p);
    }
    return out;
}

export function isBlueprintIndexPathField(
    blueprint: Blueprint | null | undefined,
    fieldName: string,
): boolean {
    return getBlueprintIndexPathFieldSet(blueprint).has(fieldName);
}

/** Row header in preview: common keys, then first non-empty list-tier (layer/level ≤ 0) field, else id. */
export function resolveDocumentTitle(
    data: Record<string, unknown>,
    blueprint?: Blueprint | null,
): string {
    if (!data || typeof data !== "object") return "";
    const id = data._id != null ? String(data._id) : "";

    for (const k of ["name", "title", "label", "subject", "headline"]) {
        const v = data[k];
        if (v != null && String(v).trim() !== "") return String(v);
    }

    const fields = blueprint?.fields;
    if (Array.isArray(fields)) {
        const ordered = [...fields]
            .filter((f) => isBlueprintTableField(f))
            .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        for (const f of ordered) {
            const v = data[f.name];
            if (v == null || v === "") continue;
            if (typeof v === "object") continue;
            const s = String(v).trim();
            if (s) return s;
        }
    }

    return id || "—";
}

// Declare the DataItem interface
export interface DataItem {
    _id?: string; // Add other properties as needed
    [key: string]: any; // Adjust this to the specific structure of your data
}

// Async function to fetch data based on valid source and update blueprint
export const overloadBlueprint = async (
    currentBlueprint: Blueprint,
    portfolio_id: string,
    org_id: string,
    options?: { eagerLoadSources?: boolean },
): Promise<Blueprint | null> => {
    console.log('Running overloadBlueprint function');

    // Work with the blueprint passed from fetchBlueprint
    if (!currentBlueprint || !currentBlueprint.fields) return null;

    const updatedBlueprint = { ...currentBlueprint, rich: { ...currentBlueprint.rich } };

    if (!updatedBlueprint.rich) {
        updatedBlueprint.rich = {};
    }

    if (!updatedBlueprint.sources) {
        updatedBlueprint.sources = {};
    }

    const eagerLoadSources = options?.eagerLoadSources !== false;

    for (const field of currentBlueprint.fields) {
        const sourceSpec = parseBlueprintSourceSpec(field.source);
        if (sourceSpec) {
                const x = sourceSpec.target;
                const y = "_id";
                const z = sourceSpec.targetLabelFields.length > 0
                    ? sourceSpec.targetLabelFields.join(",")
                    : "name";
                // Generate "sources" object (legacy-compatible key for rich lookups)
                if (field.name && typeof field.name === "string") {
                    updatedBlueprint.sources[field.name] = `${x}:${y}:${z}`;
                }

                // Skip repeated fetches for the same source target in the same overload run.
                if (
                    updatedBlueprint.rich[x] &&
                    typeof updatedBlueprint.rich[x] === "object" &&
                    Object.keys(updatedBlueprint.rich[x]).length > 0
                ) {
                    continue;
                }

                if (!eagerLoadSources) {
                    continue;
                }

                // Generate "rich" object
                try {

                    const params = new URLSearchParams({
                        all:'true',
                    });

                    const dataResponse = await fetch(`${import.meta.env.VITE_API_URL}/_data/${portfolio_id}/${org_id}/${x}?${params.toString()}`, {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${sessionStorage.accessToken}`,
                        },
                    });

                    const response = await dataResponse.json();
                    const data = response['items'];

                    if (!updatedBlueprint.rich[x]) {
                        updatedBlueprint.rich[x] = {};
                    }

                    data.forEach((item: DataItem) => {
                        const yValue = item[y];
                        // const zValue = item[z]; // Remove this line if zValue is not needed

                        // Safely split z if it contains a comma
                        const zKeys = z.split(',').map(key => key.trim());
                        const concatenatedZValue = zKeys.map(key => item[key]).filter(value => value).join(', '); // Concatenate non-empty values

                        if (yValue && concatenatedZValue) {
                            updatedBlueprint.rich[x][yValue] = concatenatedZValue; // Use concatenated value
                        }
                    });
                } catch (error) {
                    console.error(`Error fetching data for ${x}:`, error);
                }
        }
    }

    console.log('Overloaded Blueprint:');
    console.log(updatedBlueprint);
    return updatedBlueprint; // Return the updated blueprint
}

export const enrichBlueprintRichFromRows = async (
    rows: DataItem[],
    currentBlueprint: Blueprint,
    portfolio_id: string,
    org_id: string,
): Promise<void> => {
    if (!Array.isArray(rows) || rows.length === 0 || !currentBlueprint?.fields) return;

    if (!currentBlueprint.rich) currentBlueprint.rich = {};
    if (!currentBlueprint.sources) currentBlueprint.sources = {};

    const targetToIds = new Map<
        string,
        { targetKey: string; labelKeys: string[]; ids: Set<string> }
    >();

    for (const field of currentBlueprint.fields) {
        const sourceSpec = parseBlueprintSourceSpec(field.source);
        if (!sourceSpec || !field?.name) continue;

        const target = sourceSpec.target;
        const targetKey = sourceSpec.targetKey || "_id";
        const labelKeys = sourceSpec.targetLabelFields.length > 0 ? sourceSpec.targetLabelFields : ["name"];

        currentBlueprint.sources[field.name] = `${target}:${targetKey}:${labelKeys.join(",")}`;

        if (!targetToIds.has(target)) {
            targetToIds.set(target, { targetKey, labelKeys, ids: new Set<string>() });
        }
        const bucket = targetToIds.get(target)!;
        if (!bucket.targetKey) bucket.targetKey = targetKey;
        if (!bucket.labelKeys.length) bucket.labelKeys = labelKeys;

        const richMap = currentBlueprint.rich[target] ?? {};
        for (const row of rows) {
            if (!row || typeof row !== "object") continue;
            const rawValue = row[field.name];
            const entries = Array.isArray(rawValue) ? rawValue : rawValue == null ? [] : [rawValue];
            for (const entry of entries) {
                const refId = readReferenceValue(entry);
                if (!refId) continue;
                if (richMap[refId]) continue;
                bucket.ids.add(refId);
            }
        }
    }

    for (const [target, info] of targetToIds.entries()) {
        if (info.ids.size === 0) continue;
        if (!currentBlueprint.rich[target]) currentBlueprint.rich[target] = {};
        const richMap = currentBlueprint.rich[target];

        const ids = Array.from(info.ids);
        await Promise.all(
            ids.map(async (id) => {
                try {
                    const response = await fetch(
                        `${import.meta.env.VITE_API_URL}/_data/${portfolio_id}/${org_id}/${target}/${encodeURIComponent(id)}`,
                        {
                            method: "GET",
                            headers: { Authorization: `Bearer ${sessionStorage.accessToken}` },
                        },
                    );
                    if (!response.ok) return;
                    const payload = await response.json();
                    const item = Array.isArray(payload) ? payload[0] : payload;
                    if (!item || typeof item !== "object") return;
                    const rec = item as Record<string, unknown>;

                    const resolvedIdRaw = rec[info.targetKey] ?? rec._id ?? id;
                    const resolvedId = String(resolvedIdRaw ?? "").trim();
                    if (!resolvedId) return;

                    const labelParts = info.labelKeys
                        .map((key) => rec[key])
                        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
                        .map((v) => String(v).trim());
                    const label =
                        labelParts.join(", ") ||
                        String(rec.name ?? rec.label ?? rec.title ?? resolvedId);

                    richMap[resolvedId] = label;
                } catch {
                    // Best-effort enrichment only.
                }
            }),
        );
    }
};

// Export the replaceUUID function for use in other components
export const replaceUUID = async (currentData: DataItem[], currentBlueprint: Blueprint): Promise<DataItem[]> => {

    console.log("RICH BLUEPRINT @ replaceUUID:")
    console.log(currentData);
    console.log(currentBlueprint);

    // To Replace UUIDs with Human Readable object names
    // 1. Iterate through currentData which is a list of objects
    const updatedData = currentData.map((item: DataItem) => {
        const updatedItem: DataItem = { ...item }; // Create a copy of the item

        // 2. In each object, iterate through each attribute and replace the UUID
        for (const key in updatedItem) {
            if (updatedItem.hasOwnProperty(key)) {
                const value = updatedItem[key];
                // Replace UUID with human-readable name
                const sourceKey = currentBlueprint.sources?.[key];
                const sourceSpec = parseBlueprintSourceSpec(sourceKey);
                if (sourceSpec && currentBlueprint.rich) {
                    const richMap = currentBlueprint.rich[sourceSpec.target] ?? {};
                    if (Array.isArray(value)) {
                        updatedItem[key] = value.map((entry) =>
                            (() => {
                                const refValue = readReferenceValue(entry);
                                if (!refValue) return entry;
                                return richMap[refValue] ?? entry;
                            })()
                        );
                    } else {
                        const refValue = readReferenceValue(value);
                        updatedItem[key] = refValue ? (richMap[refValue] ?? value) : value;
                    }
                } else {
                    updatedItem[key] = value;
                }

                //console.log(`Updated key:${key}`);
                //console.log(sourceKey);
                //console.log(blueprint?.rich[sourceKey.split(':')[0]]?.[value] ?? value);
            }
        }

        //console.log('Updated Item:');
        //console.log(updatedItem);

        return updatedItem; // Return the updated item
    });

    //console.log('Updated Data:');
    //console.log(updatedData);

    // Return the updated data instead of setting it directly
    return updatedData; // Return the updated data
}