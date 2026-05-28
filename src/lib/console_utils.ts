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
    source: string;
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
    _id: string; // Add other properties as needed
    [key: string]: any; // Adjust this to the specific structure of your data
}

// Async function to fetch data based on valid source and update blueprint
export const overloadBlueprint = async (currentBlueprint: Blueprint, portfolio_id: string, org_id: string): Promise<Blueprint | null> => {
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

    for (const field of currentBlueprint.fields) {
        if (field.source) {
            const regex = /^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+:[a-zA-Z0-9_]+(,[a-zA-Z0-9_]+)*$/;

            if (regex.test(field.source)) {
                const [x, y, z] = field.source.split(':');
                // x: Ring

                // Generate "sources" object
                if (field.name) {
                    updatedBlueprint.sources[field.name] = field.source;
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
    }

    console.log('Overloaded Blueprint:');
    console.log(updatedBlueprint);
    return updatedBlueprint; // Return the updated blueprint
}

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
                if (sourceKey && currentBlueprint.rich) {
                    const richMap = currentBlueprint.rich[sourceKey.split(':')[0]] ?? {};
                    if (Array.isArray(value)) {
                        updatedItem[key] = value.map((entry) =>
                            richMap[String(entry)] ?? entry
                        );
                    } else {
                        updatedItem[key] = richMap[String(value)] ?? value;
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