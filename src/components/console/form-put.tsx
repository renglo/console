import { useState, useEffect, useContext, FormEvent, useMemo } from "react";
import { ChevronsUpDown, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/components/ui/use-toast";
import { GlobalContext } from "@/components/console/global-context";
import TagsInput from "@/components/ui/tags-input";
import { cn } from "@/lib/utils";
import { parseBlueprintSourceSpec } from "@/lib/console_utils";

interface FormPutProps {
  selectedKey: string;
  selectedValue: unknown;
  refreshUp: () => void;
  blueprint?: {
    fields?: Array<Record<string, unknown>>;
    rich?: Record<string, Record<string, unknown>>;
  };
  path: string;
  method: string;
  /** When set, use with a header <Button type="submit" form={formId} /> */
  formId?: string;
  /** Omit label / type / hint block (parent shows them in the dialog header). */
  hideChrome?: boolean;
  /** Omit the bottom Save button (submit from dialog header). */
  hideSubmitButton?: boolean;
}

const ENUM_EMPTY_VALUE = "__renglo_enum_empty__";

interface SearchableSelectProps {
  options: Record<string, string>;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

function SearchableSelect({
  options,
  value,
  onChange,
  multiple,
  placeholder,
  allowEmpty = false,
  emptyLabel = "None",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
  const selectedLabels = selectedValues
    .map((entry) => options[entry] ?? entry)
    .filter(Boolean);
  const summary = multiple
    ? selectedLabels.length > 0
      ? selectedLabels.join(", ")
      : (placeholder || "Select options")
    : selectedLabels[0] || placeholder || "Select option";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate text-left">{summary}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search options..." />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {!multiple && allowEmpty && (
                <CommandItem
                  value={`__empty__ ${emptyLabel}`}
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Checkbox checked={selectedValues.length === 0} className="pointer-events-none mr-2" />
                  <span className="truncate text-muted-foreground">{emptyLabel}</span>
                </CommandItem>
              )}
              {Object.entries(options).map(([optionValue, optionLabel]) => {
                const checked = selectedValues.includes(optionValue);
                return (
                  <CommandItem
                    key={optionValue}
                    value={`${optionLabel} ${optionValue}`}
                    onSelect={() => {
                      if (multiple) {
                        const next = checked
                          ? selectedValues.filter((entry) => entry !== optionValue)
                          : [...selectedValues, optionValue];
                        onChange(next);
                        return;
                      }
                      onChange(optionValue);
                      setOpen(false);
                    }}
                  >
                    <Checkbox checked={checked} className="pointer-events-none mr-2" />
                    <span className={cn("truncate", !checked && "text-foreground")}>
                      {optionLabel}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type EditState =
  | { kind: "string"; text: string; multiline: boolean }
  | { kind: "string-multi"; values: string[]; multiline: boolean }
  | { kind: "datetime"; text: string }
  | { kind: "datetime-multi"; values: string[] }
  | { kind: "date"; text: string }
  | { kind: "date-multi"; values: string[] }
  | { kind: "time"; text: string }
  | { kind: "time-multi"; values: string[] }
  | { kind: "daterange"; text: string }
  | { kind: "daterange-multi"; values: string[] }
  | { kind: "timerange"; text: string }
  | { kind: "timerange-multi"; values: string[] }
  | { kind: "number"; text: string }
  | { kind: "tagarray"; tags: string[] }
  | { kind: "boolean"; on: boolean }
  | { kind: "json"; text: string }
  | { kind: "json-multi"; values: string[] }
  | {
      kind: "enum-multi";
      valueKeys: string[];
      options: Record<string, string>;
      required: boolean;
    }
  | {
      kind: "enum";
      valueKey: string;
      options: Record<string, string>;
      allowEmpty: boolean;
    };

function parseFieldOptions(
  field: Record<string, unknown> | undefined,
): Record<string, string> | null {
  const raw = field?.options;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || !k) continue;
    out[k] = typeof v === "string" ? v : v == null ? "" : String(v);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parseSourceOptions(
  field: Record<string, unknown> | undefined,
  blueprint: FormPutProps["blueprint"],
): Record<string, string> | null {
  const sourceSpec = parseBlueprintSourceSpec(field?.source);
  if (!sourceSpec) return null;
  const sourceKey = sourceSpec.target;
  const richMap = blueprint?.rich?.[sourceKey];
  if (!richMap || typeof richMap !== "object" || Array.isArray(richMap)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(richMap)) {
    if (typeof k !== "string" || !k) continue;
    out[k] = typeof v === "string" ? v : v == null ? "" : String(v);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function getReferenceStoredValue(entry: unknown): string {
  if (entry === null || entry === undefined) return "";
  if (typeof entry === "object" && !Array.isArray(entry)) {
    const ref = entry as Record<string, unknown>;
    const candidate =
      ref.value ??
      ref.id ??
      ref._id ??
      (typeof ref.target === "object" && ref.target !== null
        ? (ref.target as Record<string, unknown>).id ??
          (ref.target as Record<string, unknown>)._id ??
          (ref.target as Record<string, unknown>).value
        : undefined);
    if (candidate === null || candidate === undefined) return "";
    return String(candidate).trim();
  }
  return String(entry).trim();
}

interface SourceFieldMeta {
  target: string;
  labels: [string, string];
  qualifierKeys: string[];
}

interface SourceOverrideState {
  labelForward: string;
  labelBackward: string;
  qualifiers: Record<string, string>;
}

function getSourceFieldMeta(field: Record<string, unknown> | undefined): SourceFieldMeta | null {
  const sourceSpec = parseBlueprintSourceSpec(field?.source);
  if (!sourceSpec) return null;
  if (!field?.source || typeof field.source !== "object" || Array.isArray(field.source)) return null;
  const raw = field.source as Record<string, unknown>;
  const labelsRaw = raw.label;
  const labelsList = Array.isArray(labelsRaw)
    ? labelsRaw.map((entry) => String(entry).trim()).filter(Boolean)
    : typeof labelsRaw === "string"
      ? labelsRaw.split(",").map((entry) => entry.trim()).filter(Boolean)
      : [];
  const qualifierKeys = Array.isArray(raw.qualifiers)
    ? raw.qualifiers.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
  return {
    target: sourceSpec.target,
    labels: [labelsList[0] ?? "", labelsList[1] ?? labelsList[0] ?? ""],
    qualifierKeys,
  };
}

function defaultSourceOverride(meta: SourceFieldMeta): SourceOverrideState {
  const qualifiers: Record<string, string> = {};
  meta.qualifierKeys.forEach((key) => {
    qualifiers[key] = "";
  });
  return {
    labelForward: meta.labels[0],
    labelBackward: meta.labels[1],
    qualifiers,
  };
}

function formatSourceOverrideHint(override: SourceOverrideState, qualifierKeys: string[]): string {
  const forward = override.labelForward.trim() || "none";
  const backward = override.labelBackward.trim() || "none";
  const qualifiers = qualifierKeys.length > 0
    ? qualifierKeys
      .map((key) => `${key}: ${(override.qualifiers[key] ?? "").trim() || "none"}`)
      .join(" | ")
    : "none";
  return `Forward: ${forward} | Backward: ${backward} | Qualifiers: ${qualifiers}`;
}

function buildSourceReferenceObject(
  raw: unknown,
  _meta: SourceFieldMeta,
  override: SourceOverrideState,
): Record<string, unknown> | null {
  const value = getReferenceStoredValue(raw);
  if (!value) return null;
  const labels = [override.labelForward.trim(), override.labelBackward.trim()].filter(Boolean);
  const qualifiers: Record<string, string> = {};
  Object.entries(override.qualifiers).forEach(([k, v]) => {
    qualifiers[k] = String(v ?? "");
  });
  const payload: Record<string, unknown> = { value };
  if (labels.length > 0) payload.label = labels;
  if (Object.keys(qualifiers).length > 0) payload.qualifiers = qualifiers;
  return payload;
}

/** Value persisted on the document: strip optional `id:` prefix from blueprint option keys. */
function enumOptionKeyToStoredValue(optionKey: string): string {
  if (!optionKey) return "";
  const i = optionKey.indexOf(":");
  if (i === -1) return optionKey;
  return optionKey.slice(i + 1);
}

/** Map stored document value to an option key (handles `1:employee` vs `employee`). */
function resolveEnumStoredKey(
  stored: string,
  options: Record<string, string>,
): string {
  if (!stored) return "";
  if (stored in options) return stored;
  const keys = Object.keys(options);
  for (const k of keys) {
    const tail = enumOptionKeyToStoredValue(k);
    if (tail === stored) return k;
  }
  return stored;
}

function resolveField(
  blueprint: FormPutProps["blueprint"],
  name: string,
): Record<string, unknown> | undefined {
  return blueprint?.fields?.find((f) => f.name === name) as
    | Record<string, unknown>
    | undefined;
}

function isMultipleCardinality(field: Record<string, unknown> | undefined): boolean {
  const cardinality = typeof field?.cardinality === "string" ? field.cardinality : "single";
  const normalized = cardinality.toLowerCase();
  return normalized === "multiple" || normalized === "multi";
}

function formatJsonForEditor(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseJsonForType(raw: string, fieldType?: string): unknown {
  const normalizedFieldType = String(fieldType ?? "").toLowerCase();
  if (normalizedFieldType === "string" || normalizedFieldType === "text") {
    return raw;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    if (normalizedFieldType === "array") return [];
    if (normalizedFieldType === "object") return {};
    return "";
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (normalizedFieldType === "array" && !Array.isArray(parsed)) {
    throw new Error("Expected JSON array.");
  }
  if (
    normalizedFieldType === "object" &&
    (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
  ) {
    throw new Error("Expected JSON object.");
  }
  return parsed;
}

function toDatetimeLocalValue(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDateValue(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeValue(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const direct = raw.match(/(\d{2}:\d{2})/);
  if (direct) return direct[1];
  return "";
}

function parseRangeValue(raw: unknown): [string, string] {
  const text = String(raw ?? "");
  if (!text.trim()) return ["", ""];
  if (text.includes(" - ")) {
    const [start, end] = text.split(" - ", 2).map((entry) => entry.trim());
    return [start || "", end || ""];
  }
  if (text.includes("|")) {
    const [start, end] = text.split("|", 2).map((entry) => entry.trim());
    return [start || "", end || ""];
  }
  return ["", ""];
}

function formatRangeValue(start: string, end: string): string {
  if (!start && !end) return "";
  return `${start || ""} - ${end || ""}`;
}

function buildEditState(
  selectedKey: string,
  selectedValue: unknown,
  blueprint: FormPutProps["blueprint"],
): EditState {
  const field = resolveField(blueprint, selectedKey);
  const typeRaw = field?.type;
  const typeStr =
    typeof typeRaw === "string" ? typeRaw.toLowerCase() : String(typeRaw ?? "").toLowerCase();
  const widget = typeof field?.widget === "string" ? field.widget : "";
  const isMultiple = isMultipleCardinality(field);
  const toArray = (raw: unknown): unknown[] => {
    if (raw === null || raw === undefined || raw === "") return [];
    return Array.isArray(raw) ? raw : [raw];
  };

  if (typeStr === "boolean" || typeof selectedValue === "boolean") {
    const on =
      selectedValue === null || selectedValue === undefined
        ? false
        : Boolean(selectedValue);
    return { kind: "boolean", on };
  }

  if (typeStr === "number" || typeof selectedValue === "number") {
    if (
      selectedValue === null ||
      selectedValue === undefined ||
      (typeof selectedValue === "number" && Number.isNaN(selectedValue))
    ) {
      return { kind: "number", text: "" };
    }
    return { kind: "number", text: String(selectedValue) };
  }

  if ((typeStr === "array" && widget === "tag") || (typeStr === "string" && widget === "tag")) {
    const toTags = (raw: unknown): string[] => {
      if (raw === null || raw === undefined) return [];
      if (Array.isArray(raw)) {
        return raw
          .map((entry) => String(entry ?? "").trim())
          .filter((entry) => entry.length > 0);
      }
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!trimmed) return [];
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed
              .map((entry) => String(entry ?? "").trim())
              .filter((entry) => entry.length > 0);
          }
        } catch {
          // Not JSON, fall back to comma parsing.
        }
        return trimmed
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
      }
      return [];
    };
    const tags = toTags(selectedValue);
    if (isMultiple) {
      return { kind: "tagarray", tags };
    }
    return { kind: "string", text: tags[0] ?? "", multiline: false };
  }

  if (
    isMultiple &&
    (widget === "text" || widget === "textarea") &&
    (typeStr === "string" || typeStr === "text")
  ) {
    const values = toArray(selectedValue).map((entry) => String(entry ?? ""));
    return {
      kind: "string-multi",
      values: values.length > 0 ? values : [""],
      multiline: widget === "textarea",
    };
  }

  if (widget === "datetime" && isMultiple && (typeStr === "string" || typeStr === "text")) {
    const values = toArray(selectedValue).map((entry) => String(entry ?? ""));
    return { kind: "datetime-multi", values: values.length > 0 ? values : [""] };
  }

  if (widget === "datetime" && (typeStr === "string" || typeStr === "text")) {
    return { kind: "datetime", text: String(selectedValue ?? "") };
  }

  if (widget === "date" && isMultiple && (typeStr === "string" || typeStr === "text")) {
    const values = toArray(selectedValue).map((entry) => String(entry ?? ""));
    return { kind: "date-multi", values: values.length > 0 ? values : [""] };
  }

  if (widget === "date" && (typeStr === "string" || typeStr === "text")) {
    return { kind: "date", text: String(selectedValue ?? "") };
  }

  if (widget === "time" && isMultiple && (typeStr === "string" || typeStr === "text")) {
    const values = toArray(selectedValue).map((entry) => String(entry ?? ""));
    return { kind: "time-multi", values: values.length > 0 ? values : [""] };
  }

  if (widget === "time" && (typeStr === "string" || typeStr === "text")) {
    return { kind: "time", text: String(selectedValue ?? "") };
  }

  if (widget === "daterange" && isMultiple && (typeStr === "string" || typeStr === "text")) {
    const values = toArray(selectedValue).map((entry) => String(entry ?? ""));
    return { kind: "daterange-multi", values: values.length > 0 ? values : [""] };
  }

  if (widget === "daterange" && (typeStr === "string" || typeStr === "text")) {
    return { kind: "daterange", text: String(selectedValue ?? "") };
  }

  if (widget === "timerange" && isMultiple && (typeStr === "string" || typeStr === "text")) {
    const values = toArray(selectedValue).map((entry) => String(entry ?? ""));
    return { kind: "timerange-multi", values: values.length > 0 ? values : [""] };
  }

  if (widget === "timerange" && (typeStr === "string" || typeStr === "text")) {
    return { kind: "timerange", text: String(selectedValue ?? "") };
  }

  if (widget === "json" && isMultiple) {
    const values = toArray(selectedValue).map((entry) => formatJsonForEditor(entry));
    return { kind: "json-multi", values: values.length > 0 ? values : [""] };
  }

  if (widget === "json") {
    return { kind: "json", text: formatJsonForEditor(selectedValue) };
  }

  const optionMap = parseFieldOptions(field) ?? parseSourceOptions(field, blueprint);
  if (optionMap) {
    const required =
      field?.required === true || field?.required === "true";
    if (isMultiple) {
      const rawValues = toArray(selectedValue)
        .map((entry) => getReferenceStoredValue(entry))
        .filter((entry) => entry.length > 0);
      const valueKeys = rawValues.map((value) => resolveEnumStoredKey(value, optionMap));
      const merged = { ...optionMap };
      valueKeys.forEach((key) => {
        if (key && !(key in merged)) {
          merged[key] = key;
        }
      });
      return { kind: "enum-multi", valueKeys, options: merged, required };
    }

    let raw =
      selectedValue === null || selectedValue === undefined
        ? ""
        : getReferenceStoredValue(selectedValue);
    if (!raw) {
      const def = field?.default;
      if (typeof def === "string" && def) raw = def;
    }
    const valueKey = resolveEnumStoredKey(raw, optionMap);
    const merged = { ...optionMap };
    if (valueKey && !(valueKey in merged)) {
      merged[valueKey] = valueKey;
    }
    const allowEmpty = !required;
    return { kind: "enum", valueKey, options: merged, allowEmpty };
  }

  if (typeStr === "array" || Array.isArray(selectedValue)) {
    const v = Array.isArray(selectedValue) ? selectedValue : [];
    return { kind: "json", text: JSON.stringify(v, null, 2) };
  }

  if (
    typeStr === "object" ||
    (selectedValue !== null &&
      typeof selectedValue === "object" &&
      !Array.isArray(selectedValue))
  ) {
    const v =
      selectedValue !== null &&
      typeof selectedValue === "object" &&
      !Array.isArray(selectedValue)
        ? selectedValue
        : {};
    return { kind: "json", text: JSON.stringify(v, null, 2) };
  }

  if (isMultiple && typeStr === "string") {
    const tags = toArray(selectedValue)
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => entry.length > 0);
    return { kind: "tagarray", tags };
  }

  if (isMultiple) {
    return { kind: "json", text: JSON.stringify(toArray(selectedValue), null, 2) };
  }

  const multiline = widget === "textarea";
  if (selectedValue === null || selectedValue === undefined) {
    return { kind: "string", text: "", multiline };
  }
  return { kind: "string", text: String(selectedValue), multiline };
}

function valueFromEditState(
  state: EditState,
  fieldKey: string,
  fieldType?: string,
): Record<string, unknown> {
  switch (state.kind) {
    case "string":
      return { [fieldKey]: state.text };
    case "string-multi":
      return { [fieldKey]: state.values.map((entry) => String(entry).trim()) };
    case "datetime":
      return { [fieldKey]: state.text };
    case "datetime-multi":
      return { [fieldKey]: state.values.map((entry) => String(entry).trim()) };
    case "date":
      return { [fieldKey]: state.text };
    case "date-multi":
      return { [fieldKey]: state.values.map((entry) => String(entry).trim()) };
    case "time":
      return { [fieldKey]: state.text };
    case "time-multi":
      return { [fieldKey]: state.values.map((entry) => String(entry).trim()) };
    case "daterange":
      return { [fieldKey]: state.text };
    case "daterange-multi":
      return { [fieldKey]: state.values.map((entry) => String(entry).trim()) };
    case "timerange":
      return { [fieldKey]: state.text };
    case "timerange-multi":
      return { [fieldKey]: state.values.map((entry) => String(entry).trim()) };
    case "number": {
      const t = state.text.trim();
      if (t === "") {
        throw new Error("Enter a valid number (empty is not allowed).");
      }
      const n = Number(t);
      if (!Number.isFinite(n)) {
        throw new Error("Invalid number.");
      }
      return { [fieldKey]: n };
    }
    case "tagarray":
      return { [fieldKey]: state.tags };
    case "boolean":
      return { [fieldKey]: state.on };
    case "enum":
      return { [fieldKey]: enumOptionKeyToStoredValue(state.valueKey) };
    case "enum-multi":
      return {
        [fieldKey]: state.valueKeys.map((valueKey) =>
          enumOptionKeyToStoredValue(valueKey),
        ),
      };
    case "json": {
      try {
        const parsed = parseJsonForType(state.text, fieldType);
        return { [fieldKey]: parsed };
      } catch {
        throw new Error("Invalid JSON — check brackets, commas, and quotes.");
      }
    }
    case "json-multi": {
      try {
        const parsed = state.values
          .filter((entry) => {
            if (fieldType === "string" || fieldType === "text") return true;
            return entry.trim().length > 0;
          })
          .map((entry) => parseJsonForType(entry, fieldType));
        return { [fieldKey]: parsed };
      } catch {
        throw new Error("Invalid JSON in one or more entries.");
      }
    }
  }
}

export default function FormPut({
  selectedKey,
  selectedValue,
  refreshUp,
  blueprint,
  path,
  method,
  formId,
  hideChrome = false,
  hideSubmitButton = false,
}: FormPutProps) {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("No GlobalProvider");
  }
  const { loadTree } = context;
  const { toast } = useToast();

  const [state, setState] = useState<EditState>(() =>
    buildEditState(selectedKey, selectedValue, blueprint),
  );

  const field = resolveField(blueprint, selectedKey);
  const fieldSourceKey = useMemo(() => {
    try {
      return JSON.stringify(field?.source ?? null);
    } catch {
      return String(field?.source ?? "");
    }
  }, [field?.source]);
  const sourceMeta = useMemo(() => getSourceFieldMeta(field), [fieldSourceKey]);
  const selectedValueKey = useMemo(() => {
    try {
      return JSON.stringify(selectedValue);
    } catch {
      return String(selectedValue ?? "");
    }
  }, [selectedValue]);
  const label =
    (typeof field?.label === "string" && field.label) || selectedKey;
  const typeHint =
    typeof field?.type === "string" ? field.type : undefined;
  const fieldType = typeof field?.type === "string" ? field.type : "";
  const [sourceOverrides, setSourceOverrides] = useState<SourceOverrideState[]>([]);
  const [selectEntries, setSelectEntries] = useState<string[]>([""]);

  useEffect(() => {
    setState(buildEditState(selectedKey, selectedValue, blueprint));
  }, [selectedKey, selectedValue, blueprint]);

  useEffect(() => {
    if (state.kind === "enum") {
      setSelectEntries([state.valueKey || ""]);
    } else if (state.kind === "enum-multi") {
      setSelectEntries(state.valueKeys.length > 0 ? state.valueKeys : [""]);
    } else {
      setSelectEntries([""]);
    }
  }, [state.kind, state.kind === "enum" ? state.valueKey : "", state.kind === "enum-multi" ? state.valueKeys.join("|") : ""]);

  useEffect(() => {
    if (!sourceMeta) {
      setSourceOverrides([]);
      return;
    }
    const defaults = defaultSourceOverride(sourceMeta);
    const rawValues = Array.isArray(selectedValue) ? selectedValue : [selectedValue];
    const nextOverrides = (rawValues.length > 0 ? rawValues : [undefined]).map((entry) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const ref = entry as Record<string, unknown>;
        const labelsRaw = ref.label;
        const labels = Array.isArray(labelsRaw)
          ? labelsRaw.map((item) => String(item).trim()).filter(Boolean)
          : [];
        const qualifiersRaw = ref.qualifiers;
        const qualifiersFromValue = qualifiersRaw && typeof qualifiersRaw === "object" && !Array.isArray(qualifiersRaw)
          ? Object.fromEntries(
              Object.entries(qualifiersRaw as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]),
            )
          : {};
        return {
          labelForward: labels[0] ?? defaults.labelForward,
          labelBackward: labels[1] ?? defaults.labelBackward,
          qualifiers: { ...defaults.qualifiers, ...qualifiersFromValue },
        };
      }
      return defaults;
    });
    setSourceOverrides(nextOverrides);
  }, [sourceMeta, selectedKey, selectedValueKey]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      state.kind === "enum" &&
      !state.allowEmpty &&
      (selectEntries[0] ?? "") === ""
    ) {
      toast({
        title: "Required",
        description: "Please select a value for this field.",
        variant: "destructive",
      });
      return;
    }
    if (state.kind === "enum-multi" && state.required && selectEntries.filter((entry) => entry.trim().length > 0).length === 0) {
      toast({
        title: "Required",
        description: "Please select at least one value for this field.",
        variant: "destructive",
      });
      return;
    }
    if (
      state.kind === "json-multi" &&
      (field?.required === true || field?.required === "true") &&
      state.values.every((entry) => entry.trim() === "")
    ) {
      toast({
        title: "Required",
        description: "Please provide at least one JSON entry for this field.",
        variant: "destructive",
      });
      return;
    }

    let payload: Record<string, unknown>;
    try {
      if (state.kind === "enum" || state.kind === "enum-multi") {
        const cleanedEntries = selectEntries.map((entry) => entry.trim());
        if (sourceMeta) {
          const values = (state.kind === "enum-multi" ? cleanedEntries : [cleanedEntries[0] ?? ""])
            .filter((entry) => entry.length > 0);
          const refs = values
            .map((entry, index) =>
              buildSourceReferenceObject(
                entry,
                sourceMeta,
                sourceOverrides[index] ?? defaultSourceOverride(sourceMeta),
              ),
            )
            .filter((entry): entry is Record<string, unknown> => entry !== null);
          payload = { [selectedKey]: state.kind === "enum-multi" ? refs : (refs[0] ?? "") };
        } else {
          payload = {
            [selectedKey]:
              state.kind === "enum-multi"
                ? cleanedEntries.filter((entry) => entry.length > 0)
                : (cleanedEntries[0] ?? ""),
          };
        }
      } else {
        payload = valueFromEditState(state, selectedKey, fieldType);
      }
    } catch (e) {
      toast({
        title: "Invalid value",
        description: e instanceof Error ? e.message : "Could not build update payload.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({
          title: "Saved",
          description: `${label} was updated.`,
        });
        loadTree();
        refreshUp();
      } else {
        const errorData = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        toast({
          title: "Error",
          description: errorData.message ?? `Request failed (${response.status}).`,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Failed to save",
        description: "Network or server error.",
        variant: "destructive",
      });
    }
  };

  const hint =
    state.kind === "json"
      ? "Edit as JSON. Must be valid JSON (array or object)."
      : state.kind === "json-multi"
        ? "Add or remove JSON entries. Each entry must be valid JSON."
      : state.kind === "string-multi"
        ? state.multiline
          ? "Add or remove text blocks."
          : "Add or remove text values."
      : state.kind === "datetime"
        ? "Pick date/time or edit the generated text directly."
      : state.kind === "datetime-multi"
        ? "Add or remove date/time values; each value is editable as text."
      : state.kind === "date"
        ? "Pick a date or edit the generated text directly."
      : state.kind === "date-multi"
        ? "Add or remove dates; each value is editable as text."
      : state.kind === "time"
        ? "Pick a time or edit the generated text directly."
      : state.kind === "time-multi"
        ? "Add or remove times; each value is editable as text."
      : state.kind === "daterange"
        ? "Pick start/end dates or edit the generated range text directly."
      : state.kind === "daterange-multi"
        ? "Add or remove date ranges; each range is editable as text."
      : state.kind === "timerange"
        ? "Pick start/end times or edit the generated range text directly."
      : state.kind === "timerange-multi"
        ? "Add or remove time ranges; each range is editable as text."
      : state.kind === "number"
        ? "Numeric value."
        : state.kind === "tagarray"
          ? "Press Enter, Tab, or comma to add tags."
        : state.kind === "boolean"
          ? "Toggle on or off."
          : state.kind === "enum"
            ? "Choose one of the predefined values."
            : state.kind === "enum-multi"
              ? "Choose one or more predefined values."
            : undefined;

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      {!hideChrome && (
        <div className="space-y-1.5">
          <Label htmlFor={`put-${selectedKey}`}>{label}</Label>
          {typeHint && (
            <p className="text-xs text-muted-foreground">Type: {typeHint}</p>
          )}
          {hint && (
            <p className="text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
      )}

      {hideChrome && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}

      {state.kind === "string" &&
        (state.multiline ? (
          <Textarea
            id={`put-${selectedKey}`}
            name={selectedKey}
            value={state.text}
            onChange={(e) =>
              setState({ kind: "string", text: e.target.value, multiline: true })
            }
            rows={10}
            className="font-mono text-sm"
          />
        ) : (
          <Input
            id={`put-${selectedKey}`}
            name={selectedKey}
            value={state.text}
            onChange={(e) =>
              setState({
                kind: "string",
                text: e.target.value,
                multiline: false,
              })
            }
          />
        ))}

      {state.kind === "string-multi" && (
        <div className="space-y-2">
          {state.values.map((value, index) => (
            <div key={`${selectedKey}-${index}`} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {state.multiline ? (
                  <Textarea
                    id={`put-${selectedKey}-${index}`}
                    name={selectedKey}
                    value={value}
                    rows={4}
                    onChange={(e) => {
                      const next = [...state.values];
                      next[index] = e.target.value;
                      setState({ kind: "string-multi", values: next, multiline: true });
                    }}
                  />
                ) : (
                  <Input
                    id={`put-${selectedKey}-${index}`}
                    name={selectedKey}
                    value={value}
                    onChange={(e) => {
                      const next = [...state.values];
                      next[index] = e.target.value;
                      setState({ kind: "string-multi", values: next, multiline: false });
                    }}
                  />
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700"
                onClick={() => {
                  const next = state.values.filter((_, currentIndex) => currentIndex !== index);
                  setState({
                    kind: "string-multi",
                    values: next.length ? next : [""],
                    multiline: state.multiline,
                  });
                }}
                aria-label="Remove value"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() =>
              setState({
                kind: "string-multi",
                values: [...state.values, ""],
                multiline: state.multiline,
              })
            }
            aria-label="Add value"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {state.kind === "datetime" && (
        <div className="space-y-2">
          <Input
            id={`put-${selectedKey}-datetime`}
            type="datetime-local"
            value={toDatetimeLocalValue(state.text)}
            onChange={(e) => setState({ kind: "datetime", text: e.target.value })}
          />
          <p className="text-xs text-muted-foreground break-all">
            {state.text || "YYYY-MM-DDTHH:mm"}
          </p>
        </div>
      )}

      {state.kind === "datetime-multi" && (
        <div className="space-y-2">
          {state.values.map((value, index) => (
            <div key={`${selectedKey}-datetime-${index}`} className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  id={`put-${selectedKey}-datetime-${index}`}
                  type="datetime-local"
                  value={toDatetimeLocalValue(value)}
                  onChange={(e) => {
                    const next = [...state.values];
                    next[index] = e.target.value;
                    setState({ kind: "datetime-multi", values: next });
                  }}
                />
                <p className="text-xs text-muted-foreground break-all">
                  {value || "YYYY-MM-DDTHH:mm"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700"
                onClick={() => {
                  const next = state.values.filter((_, currentIndex) => currentIndex !== index);
                  setState({ kind: "datetime-multi", values: next.length ? next : [""] });
                }}
                aria-label="Remove value"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setState({ kind: "datetime-multi", values: [...state.values, ""] })}
            aria-label="Add value"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {state.kind === "date" && (
        <div className="space-y-2">
          <Input
            id={`put-${selectedKey}-date`}
            type="date"
            value={toDateValue(state.text)}
            onChange={(e) => setState({ kind: "date", text: e.target.value })}
          />
          <p className="text-xs text-muted-foreground break-all">
            {state.text || "YYYY-MM-DD"}
          </p>
        </div>
      )}

      {state.kind === "date-multi" && (
        <div className="space-y-2">
          {state.values.map((value, index) => (
            <div key={`${selectedKey}-date-${index}`} className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  id={`put-${selectedKey}-date-${index}`}
                  type="date"
                  value={toDateValue(value)}
                  onChange={(e) => {
                    const next = [...state.values];
                    next[index] = e.target.value;
                    setState({ kind: "date-multi", values: next });
                  }}
                />
                <p className="text-xs text-muted-foreground break-all">
                  {value || "YYYY-MM-DD"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700"
                onClick={() => {
                  const next = state.values.filter((_, currentIndex) => currentIndex !== index);
                  setState({ kind: "date-multi", values: next.length ? next : [""] });
                }}
                aria-label="Remove value"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setState({ kind: "date-multi", values: [...state.values, ""] })}
            aria-label="Add value"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {state.kind === "time" && (
        <div className="space-y-2">
          <Input
            id={`put-${selectedKey}-time`}
            type="time"
            value={toTimeValue(state.text)}
            onChange={(e) => setState({ kind: "time", text: e.target.value })}
          />
          <p className="text-xs text-muted-foreground break-all">
            {state.text || "HH:mm"}
          </p>
        </div>
      )}

      {state.kind === "time-multi" && (
        <div className="space-y-2">
          {state.values.map((value, index) => (
            <div key={`${selectedKey}-time-${index}`} className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  id={`put-${selectedKey}-time-${index}`}
                  type="time"
                  value={toTimeValue(value)}
                  onChange={(e) => {
                    const next = [...state.values];
                    next[index] = e.target.value;
                    setState({ kind: "time-multi", values: next });
                  }}
                />
                <p className="text-xs text-muted-foreground break-all">
                  {value || "HH:mm"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700"
                onClick={() => {
                  const next = state.values.filter((_, currentIndex) => currentIndex !== index);
                  setState({ kind: "time-multi", values: next.length ? next : [""] });
                }}
                aria-label="Remove value"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setState({ kind: "time-multi", values: [...state.values, ""] })}
            aria-label="Add value"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {state.kind === "daterange" && (
        <div className="space-y-2">
          {(() => {
            const [startRaw, endRaw] = parseRangeValue(state.text);
            const start = toDateValue(startRaw);
            const end = toDateValue(endRaw);
            return (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    id={`put-${selectedKey}-daterange-start`}
                    type="date"
                    value={start}
                    onChange={(e) =>
                      setState({
                        kind: "daterange",
                        text: formatRangeValue(e.target.value, end),
                      })
                    }
                  />
                  <Input
                    id={`put-${selectedKey}-daterange-end`}
                    type="date"
                    value={end}
                    onChange={(e) =>
                      setState({
                        kind: "daterange",
                        text: formatRangeValue(start, e.target.value),
                      })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground break-all">
                  {state.text || "YYYY-MM-DD - YYYY-MM-DD"}
                </p>
              </>
            );
          })()}
        </div>
      )}

      {state.kind === "daterange-multi" && (
        <div className="space-y-2">
          {state.values.map((value, index) => {
            const [startRaw, endRaw] = parseRangeValue(value);
            const start = toDateValue(startRaw);
            const end = toDateValue(endRaw);
            return (
              <div key={`${selectedKey}-daterange-${index}`} className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      id={`put-${selectedKey}-daterange-start-${index}`}
                      type="date"
                      value={start}
                      onChange={(e) => {
                        const next = [...state.values];
                        next[index] = formatRangeValue(e.target.value, end);
                        setState({ kind: "daterange-multi", values: next });
                      }}
                    />
                    <Input
                      id={`put-${selectedKey}-daterange-end-${index}`}
                      type="date"
                      value={end}
                      onChange={(e) => {
                        const next = [...state.values];
                        next[index] = formatRangeValue(start, e.target.value);
                        setState({ kind: "daterange-multi", values: next });
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground break-all">
                    {value || "YYYY-MM-DD - YYYY-MM-DD"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    const next = state.values.filter((_, currentIndex) => currentIndex !== index);
                    setState({ kind: "daterange-multi", values: next.length ? next : [""] });
                  }}
                  aria-label="Remove value"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setState({ kind: "daterange-multi", values: [...state.values, ""] })}
            aria-label="Add value"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {state.kind === "timerange" && (
        <div className="space-y-2">
          {(() => {
            const [startRaw, endRaw] = parseRangeValue(state.text);
            const start = toTimeValue(startRaw);
            const end = toTimeValue(endRaw);
            return (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    id={`put-${selectedKey}-timerange-start`}
                    type="time"
                    value={start}
                    onChange={(e) =>
                      setState({
                        kind: "timerange",
                        text: formatRangeValue(e.target.value, end),
                      })
                    }
                  />
                  <Input
                    id={`put-${selectedKey}-timerange-end`}
                    type="time"
                    value={end}
                    onChange={(e) =>
                      setState({
                        kind: "timerange",
                        text: formatRangeValue(start, e.target.value),
                      })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground break-all">
                  {state.text || "HH:mm - HH:mm"}
                </p>
              </>
            );
          })()}
        </div>
      )}

      {state.kind === "timerange-multi" && (
        <div className="space-y-2">
          {state.values.map((value, index) => {
            const [startRaw, endRaw] = parseRangeValue(value);
            const start = toTimeValue(startRaw);
            const end = toTimeValue(endRaw);
            return (
              <div key={`${selectedKey}-timerange-${index}`} className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      id={`put-${selectedKey}-timerange-start-${index}`}
                      type="time"
                      value={start}
                      onChange={(e) => {
                        const next = [...state.values];
                        next[index] = formatRangeValue(e.target.value, end);
                        setState({ kind: "timerange-multi", values: next });
                      }}
                    />
                    <Input
                      id={`put-${selectedKey}-timerange-end-${index}`}
                      type="time"
                      value={end}
                      onChange={(e) => {
                        const next = [...state.values];
                        next[index] = formatRangeValue(start, e.target.value);
                        setState({ kind: "timerange-multi", values: next });
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground break-all">
                    {value || "HH:mm - HH:mm"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    const next = state.values.filter((_, currentIndex) => currentIndex !== index);
                    setState({ kind: "timerange-multi", values: next.length ? next : [""] });
                  }}
                  aria-label="Remove value"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setState({ kind: "timerange-multi", values: [...state.values, ""] })}
            aria-label="Add value"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {state.kind === "enum" && (
        <div className="space-y-2">
          {selectEntries.map((entryValue, index) => {
            const override = sourceMeta
              ? (sourceOverrides[index] ?? defaultSourceOverride(sourceMeta))
              : null;
            return (
              <div key={`${selectedKey}-enum-${index}`} className="space-y-2 rounded-md border p-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <SearchableSelect
                    options={state.options}
                    value={entryValue}
                    onChange={(next) => {
                      const nextValue = String(Array.isArray(next) ? next[0] ?? "" : next);
                      const nextEntries = [...selectEntries];
                      nextEntries[index] = nextValue === ENUM_EMPTY_VALUE ? "" : nextValue;
                      setSelectEntries(nextEntries);
                      setState({
                        kind: "enum",
                        valueKey: nextEntries[0] ?? "",
                        options: state.options,
                        allowEmpty: state.allowEmpty,
                      });
                    }}
                    multiple={false}
                    placeholder="Select..."
                    allowEmpty={state.allowEmpty}
                    emptyLabel="None"
                  />
                  {sourceMeta && override && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="icon" aria-label="Relationship details">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-96 space-y-3" align="start">
                        <p className="text-xs text-muted-foreground">Override edge labels and qualifiers.</p>
                        <div className="grid gap-2">
                          <Label htmlFor={`${selectedKey}-${index}-label-forward`} className="text-xs">Forward label</Label>
                          <Input
                            id={`${selectedKey}-${index}-label-forward`}
                            value={override.labelForward}
                            onChange={(event) =>
                              setSourceOverrides((prev) => {
                                const next = [...prev];
                                next[index] = { ...override, labelForward: event.target.value };
                                return next;
                              })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`${selectedKey}-${index}-label-backward`} className="text-xs">Backward label</Label>
                          <Input
                            id={`${selectedKey}-${index}-label-backward`}
                            value={override.labelBackward}
                            onChange={(event) =>
                              setSourceOverrides((prev) => {
                                const next = [...prev];
                                next[index] = { ...override, labelBackward: event.target.value };
                                return next;
                              })
                            }
                          />
                        </div>
                        {sourceMeta.qualifierKeys.map((qualifierKey) => (
                          <div key={`${selectedKey}-${index}-qualifier-${qualifierKey}`} className="grid gap-2">
                            <Label htmlFor={`${selectedKey}-${index}-qualifier-${qualifierKey}`} className="text-xs">
                              Qualifier: {qualifierKey}
                            </Label>
                            <Input
                              id={`${selectedKey}-${index}-qualifier-${qualifierKey}`}
                              value={override.qualifiers[qualifierKey] ?? ""}
                              onChange={(event) =>
                                setSourceOverrides((prev) => {
                                  const next = [...prev];
                                  next[index] = {
                                    ...override,
                                    qualifiers: {
                                      ...override.qualifiers,
                                      [qualifierKey]: event.target.value,
                                    },
                                  };
                                  return next;
                                })
                              }
                            />
                          </div>
                        ))}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                {sourceMeta && override && (
                  <p className="text-xs text-muted-foreground">
                    {formatSourceOverrideHint(override, sourceMeta.qualifierKeys)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {state.kind === "enum-multi" && (
        <div className="space-y-2">
          {selectEntries.map((entryValue, index) => {
            const override = sourceMeta
              ? (sourceOverrides[index] ?? defaultSourceOverride(sourceMeta))
              : null;
            return (
              <div key={`${selectedKey}-enum-multi-${index}`} className="space-y-2 rounded-md border p-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <SearchableSelect
                      options={state.options}
                      value={entryValue}
                      onChange={(next) => {
                        const nextValue = String(Array.isArray(next) ? next[0] ?? "" : next);
                        const nextEntries = [...selectEntries];
                        nextEntries[index] = nextValue;
                        setSelectEntries(nextEntries);
                        setState({
                          kind: "enum-multi",
                          valueKeys: nextEntries.filter((entry) => entry.trim().length > 0),
                          options: state.options,
                          required: state.required,
                        });
                      }}
                      multiple={false}
                      placeholder="Select..."
                    />
                    {sourceMeta && override && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="icon" aria-label="Relationship details">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 space-y-3" align="start">
                          <p className="text-xs text-muted-foreground">Override edge labels and qualifiers.</p>
                          <div className="grid gap-2">
                            <Label htmlFor={`${selectedKey}-multi-${index}-label-forward`} className="text-xs">Forward label</Label>
                            <Input
                              id={`${selectedKey}-multi-${index}-label-forward`}
                              value={override.labelForward}
                              onChange={(event) =>
                                setSourceOverrides((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...override, labelForward: event.target.value };
                                  return next;
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`${selectedKey}-multi-${index}-label-backward`} className="text-xs">Backward label</Label>
                            <Input
                              id={`${selectedKey}-multi-${index}-label-backward`}
                              value={override.labelBackward}
                              onChange={(event) =>
                                setSourceOverrides((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...override, labelBackward: event.target.value };
                                  return next;
                                })
                              }
                            />
                          </div>
                          {sourceMeta.qualifierKeys.map((qualifierKey) => (
                            <div key={`${selectedKey}-multi-${index}-qualifier-${qualifierKey}`} className="grid gap-2">
                              <Label htmlFor={`${selectedKey}-multi-${index}-qualifier-${qualifierKey}`} className="text-xs">
                                Qualifier: {qualifierKey}
                              </Label>
                              <Input
                                id={`${selectedKey}-multi-${index}-qualifier-${qualifierKey}`}
                                value={override.qualifiers[qualifierKey] ?? ""}
                                onChange={(event) =>
                                  setSourceOverrides((prev) => {
                                    const next = [...prev];
                                    next[index] = {
                                      ...override,
                                      qualifiers: {
                                        ...override.qualifiers,
                                        [qualifierKey]: event.target.value,
                                      },
                                    };
                                    return next;
                                  })
                                }
                              />
                            </div>
                          ))}
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      const nextEntries = selectEntries.filter((_, currentIndex) => currentIndex !== index);
                      const normalized = nextEntries.length > 0 ? nextEntries : [""];
                      setSelectEntries(normalized);
                      setSourceOverrides((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
                      setState({
                        kind: "enum-multi",
                        valueKeys: normalized.filter((entry) => entry.trim().length > 0),
                        options: state.options,
                        required: state.required,
                      });
                    }}
                    aria-label="Remove relationship"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {sourceMeta && override && (
                  <p className="text-xs text-muted-foreground">
                    {formatSourceOverrideHint(override, sourceMeta.qualifierKeys)}
                  </p>
                )}
              </div>
            );
          })}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setSelectEntries([...selectEntries, ""])}
            aria-label="Add relationship"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {state.kind === "number" && (
        <Input
          id={`put-${selectedKey}`}
          name={selectedKey}
          type="number"
          step="any"
          value={state.text}
          onChange={(e) => setState({ kind: "number", text: e.target.value })}
        />
      )}

      {state.kind === "tagarray" && (
        <TagsInput
          value={state.tags}
          onChange={(next) => setState({ kind: "tagarray", tags: next })}
          placeholder="Type and press Enter"
        />
      )}

      {state.kind === "boolean" && (
        <div className="flex items-center gap-3">
          <Switch
            id={`put-${selectedKey}`}
            checked={state.on}
            onCheckedChange={(on) => setState({ kind: "boolean", on })}
          />
          <Label htmlFor={`put-${selectedKey}`} className="font-normal">
            {state.on ? "True" : "False"}
          </Label>
        </div>
      )}

      {state.kind === "json" && (
        <Textarea
          id={`put-${selectedKey}`}
          name={selectedKey}
          value={state.text}
          onChange={(e) => setState({ kind: "json", text: e.target.value })}
          rows={16}
          className="font-mono text-xs leading-relaxed"
          spellCheck={false}
        />
      )}

      {state.kind === "json-multi" && (
        <div className="space-y-2">
          {state.values.map((value, index) => (
            <div key={`${selectedKey}-json-${index}`} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Textarea
                  id={`put-${selectedKey}-json-${index}`}
                  name={selectedKey}
                  value={value}
                  onChange={(e) => {
                    const next = [...state.values];
                    next[index] = e.target.value;
                    setState({ kind: "json-multi", values: next });
                  }}
                  rows={10}
                  className="font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700"
                onClick={() => {
                  const next = state.values.filter((_, currentIndex) => currentIndex !== index);
                  setState({ kind: "json-multi", values: next.length ? next : [""] });
                }}
                aria-label="Remove value"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setState({ kind: "json-multi", values: [...state.values, ""] })}
            aria-label="Add value"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!hideSubmitButton && <Button type="submit">Save</Button>}
    </form>
  );
}
