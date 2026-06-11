import { useState,useEffect,useContext } from 'react';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChevronsUpDown, MoreHorizontal, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import TagsInput from "@/components/ui/tags-input";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"; // Assuming these are the correct imports
import { useToast } from "@/components/ui/use-toast";
import {GlobalContext} from "@/components/console/global-context"
import { cn } from "@/lib/utils";
import { parseBlueprintSourceSpec } from "@/lib/console_utils";


interface FieldDefinition {
    name: string;
    type: 'string' | 'number' | 'integer' | 'float' | 'timestamp' | 'array' | 'object'; // Added complex types
    label: string;
    required: boolean;
    widget: 'text' | 'textarea' | 'date' | 'time' | 'datetime' | 'timerange' | 'daterange' | 'number' | 'select' | 'image' | 'select-cascade' | 'tag' | 'json';
    cardinality?: 'single' | 'singular' | 'multiple' | string;
    hint?: string; // Optional hint for placeholders
    options?: Record<string, string> | Record<string, Record<string, string>>; // select: key-value; select-cascade: outerKey -> key-value
    source?: unknown; // legacy string or new source object
    [key: string]: any; // Additional properties
}

interface RichDefinition {
  [key: string]: {
    [innerKey: string]: string; // All inner values must be strings
  };
}


interface FormField {
    value: any;
    onChange: (value: any) => void;
    [key: string]: any; // Additional form field properties
  }

interface SearchableSelectProps {
  options: Record<string, string>;
  value: unknown;
  onChange: (value: string | string[]) => void;
  multiple: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  onSearch?: () => void;
  searching?: boolean;
  searchError?: string;
  searchPlaceholder?: string;
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

function parseJsonEditorValue(raw: unknown, fieldType: string): unknown {
  if (fieldType === "string" || fieldType === "text") {
    if (raw === null || raw === undefined) return "";
    return String(raw);
  }
  if (raw === null || raw === undefined) {
    return fieldType === "array" ? [] : fieldType === "object" ? {} : raw;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return fieldType === "array" ? [] : fieldType === "object" ? {} : "";
    }
    const parsed = JSON.parse(trimmed);
    if (fieldType === "array" && !Array.isArray(parsed)) {
      throw new Error("Expected JSON array.");
    }
    if (fieldType === "object" && (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))) {
      throw new Error("Expected JSON object.");
    }
    return parsed;
  }
  return raw;
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

function SearchableSelect({
  options,
  value,
  onChange,
  multiple,
  placeholder,
  allowEmpty = false,
  emptyLabel = "None",
  searchQuery,
  onSearchQueryChange,
  onSearch,
  searching = false,
  searchError = "",
  searchPlaceholder = "Search by text",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedValues = Array.isArray(value)
    ? value.map((entry) => String(entry))
    : value
      ? [String(value)]
      : [];
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
        {onSearch ? (
          <div className="space-y-2 border-b p-2">
            <div className="flex gap-2">
              <Input
                value={searchQuery ?? ""}
                onChange={(event) => onSearchQueryChange?.(event.target.value)}
                placeholder={searchPlaceholder}
              />
              <Button type="button" size="sm" onClick={onSearch} disabled={searching}>
                {searching ? "Searching..." : "Search"}
              </Button>
            </div>
            {searchError ? <p className="text-xs text-destructive">{searchError}</p> : null}
          </div>
        ) : null}
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


function generateSchema(fieldArray: FieldDefinition[]): z.ZodObject<any> {
  const formSchemaFields = fieldArray.reduce<Record<string, z.ZodTypeAny>>((schema, field) => {
    const isMultiple = String(field.cardinality ?? "single").toLowerCase() === "multiple";
    let validation: z.ZodTypeAny = z.string();
    if (field.widget === "json") {
      validation = isMultiple
        ? z.preprocess(
            (value) => {
              if (value === null || value === undefined || value === "") return [];
              if (Array.isArray(value)) {
                return value.map((entry) => String(entry ?? ""));
              }
              return [String(value)];
            },
            z.array(z.string())
          )
        : z.preprocess(
            (value) => (value === null || value === undefined ? "" : String(value)),
            z.string()
          );
    } else if (field.type === "number" || field.type === "integer" || field.type === "float") {
      const numericValidation = z.preprocess(
        (value) => {
          if (value === "" || value === null || value === undefined) return undefined;
          if (typeof value === "number") return value;
          const parsed = Number(value);
          return Number.isNaN(parsed) ? value : parsed;
        },
        z.number()
      );
      validation = isMultiple
        ? z.preprocess(
            (value) => {
              if (value === null || value === undefined || value === "") return [];
              return Array.isArray(value) ? value : [value];
            },
            z.array(numericValidation)
          )
        : numericValidation;
    } else if (field.type === "array") {
      const arrayValidation = z.preprocess(
        (value) => {
          if (value === null || value === undefined || value === "") return [];
          if (Array.isArray(value)) {
            return value
              .map((entry) => String(entry ?? "").trim())
              .filter(Boolean);
          }
          if (typeof value === "string") {
            return value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean);
          }
          return value;
        },
        z.array(z.string())
      );
      validation = isMultiple
        ? z.preprocess(
            (value) => {
              if (value === null || value === undefined || value === "") return [];
              if (Array.isArray(value)) {
                if (value.length === 0 || value.some((entry) => Array.isArray(entry))) return value;
                return [value];
              }
              return [value];
            },
            z.array(arrayValidation)
          )
        : arrayValidation;
    } else if (field.type === "string" && isMultiple) {
      validation = z.preprocess(
        (value) => {
          if (value === null || value === undefined || value === "") return [];
          if (Array.isArray(value)) {
            return value.map((entry) => String(entry ?? "").trim());
          }
          return [String(value).trim()];
        },
        z.array(z.string())
      );
    }
  
    if (field.required) {
      if (validation instanceof z.ZodString) {
        validation = validation.min(1, { message: `${field.label} is required.` });
      } else if (validation instanceof z.ZodArray) {
        validation = validation.min(1, { message: `${field.label} needs at least one item.` });
      }
    } else if (!isMultiple) {
      validation = validation.optional();
    }
  
    return { ...schema, [field.name]: validation };
  }, {});
  
  return z.object(formSchemaFields);
}




interface FieldOption {
  [key: string]: string;
}

function isCascadeOptions(opts: Record<string, string> | Record<string, Record<string, string>>): opts is Record<string, Record<string, string>> {
  if (!opts || typeof opts !== 'object') return false;
  const firstKey = Object.keys(opts)[0];
  if (firstKey === undefined) return false;
  return typeof opts[firstKey] === 'object' && opts[firstKey] !== null && !Array.isArray(opts[firstKey]);
}

interface Field {
  cardinality: string;
  default: string;
  hint: string;
  id: string;
  label: string;
  layer: string;
  multilingual: boolean;
  name: string;
  order: string;
  required: boolean;
  semantic: string;
  source: unknown;
  type: string;
  widget: string;
  options?: FieldOption | Record<string, Record<string, string>>; // select: FieldOption; select-cascade: dict of dicts
}

interface Blueprint {
  _id: string;
  added: string;
  blueprint_origin: string;
  description: string;
  fields: Field[];
  handle: string;
  irn: string;
  label: string;
  license: string;
  name: string;
  public: boolean;
  status: string;
  uri: string;
  version: string;
  rich?: {
    [key: string]: {
      [key: string]: string; // Or use any other type if needed
    }
  };
}


interface FormPostProps {
    refreshUp: () => void; 
    blueprint: Blueprint;
    path: string;
    method: string;
    formId?: string;
    hideSubmitButton?: boolean;
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

function getSourceFieldMeta(field: FieldDefinition): SourceFieldMeta | null {
  const sourceSpec = parseBlueprintSourceSpec(field.source);
  if (!sourceSpec) return null;
  if (!field.source || typeof field.source !== "object" || Array.isArray(field.source)) return null;
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
    labels: [
      labelsList[0] ?? "",
      labelsList[1] ?? labelsList[0] ?? "",
    ],
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

function getSourceOverrideAt(
  overridesByField: Record<string, SourceOverrideState[]>,
  fieldName: string,
  index: number,
  meta: SourceFieldMeta,
): SourceOverrideState {
  return overridesByField[fieldName]?.[index] ?? defaultSourceOverride(meta);
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

function extractReferenceId(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const ref = raw as Record<string, unknown>;
    const nested = ref.target;
    const nestedObj = nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : undefined;
    const candidate =
      ref.value ??
      ref.id ??
      ref._id ??
      nestedObj?.value ??
      nestedObj?.id ??
      nestedObj?._id;
    return candidate == null ? "" : String(candidate).trim();
  }
  return String(raw).trim();
}

function parseScopeFromDataPath(path: string): { portfolio: string; org: string } | null {
  const match = path.match(/\/_data\/([^/]+)\/([^/]+)\//);
  if (!match) return null;
  return {
    portfolio: decodeURIComponent(match[1]),
    org: decodeURIComponent(match[2]),
  };
}

function labelFromResolvedSearchHit(
  hit: Record<string, unknown>,
  labelFields: string[],
): string {
  const doc = hit.document && typeof hit.document === "object" && !Array.isArray(hit.document)
    ? (hit.document as Record<string, unknown>)
    : null;
  const attrs = doc?.attributes && typeof doc.attributes === "object" && !Array.isArray(doc.attributes)
    ? (doc.attributes as Record<string, unknown>)
    : null;
  if (!attrs) return "";

  const parts = labelFields
    .map((field) => attrs[field])
    .filter((entry) => entry !== null && entry !== undefined && String(entry).trim() !== "")
    .map((entry) => String(entry).trim());
  if (parts.length > 0) return parts.join(", ");

  const fallback = attrs.name ?? attrs.label ?? attrs.title;
  return fallback == null ? "" : String(fallback).trim();
}

function buildSourceReferenceObject(
  raw: unknown,
  meta: SourceFieldMeta,
  override: SourceOverrideState,
): Record<string, unknown> | null {
  const value = extractReferenceId(raw);
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

  

export default function FormPost({
  refreshUp,
  blueprint,
  path,
  method,
  formId,
  hideSubmitButton = false,
}: FormPostProps) {

  console.log('Blueprint @ FormPost')
  console.log(blueprint);

  
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('No GlobalProvider');
  }
  const { loadTree } = context;
  
  const [Fields, setFields] = useState<FieldDefinition[]>([]);
  const [Rich, setRich] = useState<RichDefinition>({});
  const [file, setFile] = useState<File | null>(null);
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, SourceOverrideState[]>>({});
  const [sourceSearchDraftByField, setSourceSearchDraftByField] = useState<Record<string, string>>({});
  const [sourceSearchLoadingByField, setSourceSearchLoadingByField] = useState<Record<string, boolean>>({});
  const [sourceSearchErrorByField, setSourceSearchErrorByField] = useState<Record<string, string>>({});
  const [sourceSearchOptionsByField, setSourceSearchOptionsByField] = useState<
    Record<string, Record<string, string>>
  >({});

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; // Get the uploaded file
    if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
      console.log("setting new file");
      setFile(file); // Store the file for uploading via FormData
    } else {
      alert("Please upload a valid image file");
    }

  };

  const runSourceSearch = async (field: FieldDefinition): Promise<void> => {
    const sourceSpec = parseBlueprintSourceSpec(field.source);
    if (!sourceSpec) return;

    const query = String(sourceSearchDraftByField[field.name] ?? "").trim();
    if (!query) {
      setSourceSearchErrorByField((prev) => ({ ...prev, [field.name]: "Enter a search query." }));
      return;
    }

    const scope = parseScopeFromDataPath(path);
    if (!scope) {
      setSourceSearchErrorByField((prev) => ({
        ...prev,
        [field.name]: "Could not resolve portfolio/org for search.",
      }));
      return;
    }

    setSourceSearchLoadingByField((prev) => ({ ...prev, [field.name]: true }));
    setSourceSearchErrorByField((prev) => ({ ...prev, [field.name]: "" }));
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/_search/${encodeURIComponent(scope.portfolio)}/${encodeURIComponent(scope.org)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.accessToken}`,
          },
          body: JSON.stringify({
            query,
            limit: 40,
            offset: 0,
            filters: {
              rings: [sourceSpec.target],
              resolve: true,
            },
          }),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok || payload.success === false) {
        throw new Error(String(payload.message || `Search failed (${response.status})`));
      }

      const items = Array.isArray(payload.items) ? payload.items : [];
      const nextOptions: Record<string, string> = {};
      const missingDocIds: string[] = [];

      for (const item of items) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const hit = item as Record<string, unknown>;
        const docId = String(hit.doc_id ?? "").trim();
        if (!docId) continue;
        const label = labelFromResolvedSearchHit(hit, sourceSpec.targetLabelFields);
        if (label) {
          nextOptions[docId] = label;
        } else {
          missingDocIds.push(docId);
        }
      }

      if (missingDocIds.length > 0) {
        const resolved = await Promise.allSettled(
          missingDocIds.map(async (docId) => {
            const docResponse = await fetch(
              `${import.meta.env.VITE_API_URL}/_data/${encodeURIComponent(scope.portfolio)}/${encodeURIComponent(scope.org)}/${encodeURIComponent(sourceSpec.target)}/${encodeURIComponent(docId)}`,
              {
                method: "GET",
                headers: { Authorization: `Bearer ${sessionStorage.accessToken}` },
              },
            );
            if (!docResponse.ok) return null;
            const docPayload = (await docResponse.json().catch(() => null)) as Record<string, unknown> | null;
            if (!docPayload || typeof docPayload !== "object" || Array.isArray(docPayload)) return null;
            const attrs = docPayload.attributes && typeof docPayload.attributes === "object" && !Array.isArray(docPayload.attributes)
              ? (docPayload.attributes as Record<string, unknown>)
              : docPayload;
            const parts = sourceSpec.targetLabelFields
              .map((fieldName) => attrs[fieldName])
              .filter((entry) => entry !== null && entry !== undefined && String(entry).trim() !== "")
              .map((entry) => String(entry).trim());
            const label = parts.join(", ") || String(attrs.name ?? attrs.label ?? attrs.title ?? docId);
            return { docId, label };
          }),
        );
        resolved.forEach((entry) => {
          if (entry.status === "fulfilled" && entry.value) {
            nextOptions[entry.value.docId] = entry.value.label;
          }
        });
      }

      setSourceSearchOptionsByField((prev) => ({
        ...prev,
        [field.name]: { ...(prev[field.name] ?? {}), ...nextOptions },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search failed.";
      setSourceSearchErrorByField((prev) => ({ ...prev, [field.name]: message }));
      toast({
        title: "Search failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSourceSearchLoadingByField((prev) => ({ ...prev, [field.name]: false }));
    }
  };
  
  
    
  // Function to render the form field based on the field's widget type
  function renderFormField(field: FieldDefinition, formField: FormField, Rich: RichDefinition, form: { watch: (name: string) => unknown }) {
      const isMultiple = String(field.cardinality ?? "single").toLowerCase() === "multiple";
      const resolveSelectOptions = (): Record<string, string> => {
        if (field.options && !isCascadeOptions(field.options)) {
          return Object.entries(field.options).reduce<Record<string, string>>((acc, [value, label]) => {
            acc[value.includes(":") ? value.split(":")[1] : value] = String(label);
            return acc;
          }, {});
        }
        const sourceSpec = parseBlueprintSourceSpec(field.source);
        const richKey = sourceSpec?.target ?? "";
        return Rich[richKey] ?? {};
      };


  
      switch (field.widget) {
        case "text":
          if (isMultiple) {
            const currentValues = Array.isArray(formField.value)
              ? formField.value.map((value) => String(value ?? ""))
              : formField.value
                ? [String(formField.value)]
                : [""];
            return (
              <div className="space-y-2">
                {currentValues.map((value, index) => (
                  <div key={`${field.name}-${index}`} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Input
                        placeholder={field.hint}
                        value={value}
                        onChange={(event) => {
                          const next = [...currentValues];
                          next[index] = event.target.value;
                          formField.onChange(next);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
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
                  onClick={() => formField.onChange([...currentValues, ""])}
                  aria-label="Add value"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            );
          }
          return <Input placeholder={field.hint} {...formField} />;

        case "textarea":
          if (isMultiple) {
            const currentValues = Array.isArray(formField.value)
              ? formField.value.map((value) => String(value ?? ""))
              : formField.value
                ? [String(formField.value)]
                : [""];
            return (
              <div className="space-y-2">
                {currentValues.map((value, index) => (
                  <div key={`${field.name}-textarea-${index}`} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Textarea
                        placeholder={field.hint}
                        value={value}
                        rows={4}
                        onChange={(event) => {
                          const next = [...currentValues];
                          next[index] = event.target.value;
                          formField.onChange(next);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
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
                  onClick={() => formField.onChange([...currentValues, ""])}
                  aria-label="Add value"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            );
          }
          return <Textarea placeholder={field.hint} rows={4} {...formField} />;

        case "datetime":
          if (isMultiple) {
            const currentValues = Array.isArray(formField.value)
              ? formField.value.map((value) => String(value ?? ""))
              : formField.value
                ? [String(formField.value)]
                : [""];
            return (
              <div className="space-y-2">
                {currentValues.map((value, index) => (
                  <div key={`${field.name}-datetime-${index}`} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        type="datetime-local"
                        value={toDatetimeLocalValue(value)}
                        onChange={(event) => {
                          const next = [...currentValues];
                          next[index] = event.target.value;
                          formField.onChange(next);
                        }}
                      />
                      <p className="text-xs text-muted-foreground break-all">
                        {value || field.hint || "YYYY-MM-DDTHH:mm"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
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
                  onClick={() => formField.onChange([...currentValues, ""])}
                  aria-label="Add value"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            );
          }
          return (
            <div className="space-y-2">
              <Input
                type="datetime-local"
                value={toDatetimeLocalValue(formField.value)}
                onChange={(event) => formField.onChange(event.target.value)}
              />
              <p className="text-xs text-muted-foreground break-all">
                {String(formField.value ?? "") || field.hint || "YYYY-MM-DDTHH:mm"}
              </p>
            </div>
          );

        case "json":
          if (isMultiple) {
            const currentValues = Array.isArray(formField.value)
              ? formField.value.map((value) => formatJsonForEditor(value))
              : formField.value
                ? [formatJsonForEditor(formField.value)]
                : [""];
            return (
              <div className="space-y-2">
                {currentValues.map((value, index) => (
                  <div key={`${field.name}-json-${index}`} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Textarea
                        placeholder={field.hint || "Enter JSON"}
                        value={value}
                        rows={8}
                        className="font-mono text-xs leading-relaxed"
                        spellCheck={false}
                        onChange={(event) => {
                          const next = [...currentValues];
                          next[index] = event.target.value;
                          formField.onChange(next);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
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
                  onClick={() => formField.onChange([...currentValues, ""])}
                  aria-label="Add value"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            );
          }
          return (
            <Textarea
              placeholder={field.hint || "Enter JSON"}
              value={formatJsonForEditor(formField.value)}
              rows={10}
              className="font-mono text-xs leading-relaxed"
              spellCheck={false}
              onChange={(event) => formField.onChange(event.target.value)}
            />
          );
  
        case "date":
          if (isMultiple) {
            const currentValues = Array.isArray(formField.value)
              ? formField.value.map((value) => String(value ?? ""))
              : formField.value
                ? [String(formField.value)]
                : [""];
            return (
              <div className="space-y-2">
                {currentValues.map((value, index) => (
                  <div key={`${field.name}-date-${index}`} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        type="date"
                        value={toDateValue(value)}
                        onChange={(event) => {
                          const next = [...currentValues];
                          next[index] = event.target.value;
                          formField.onChange(next);
                        }}
                      />
                      <p className="text-xs text-muted-foreground break-all">
                        {value || field.hint || "YYYY-MM-DD"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
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
                  onClick={() => formField.onChange([...currentValues, ""])}
                  aria-label="Add value"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            );
          }
          return (
            <div className="space-y-2">
              <Input
                type="date"
                value={toDateValue(formField.value)}
                onChange={(event) => formField.onChange(event.target.value)}
              />
              <p className="text-xs text-muted-foreground break-all">
                {String(formField.value ?? "") || field.hint || "YYYY-MM-DD"}
              </p>
            </div>
          );

        case "time":
          if (isMultiple) {
            const currentValues = Array.isArray(formField.value)
              ? formField.value.map((value) => String(value ?? ""))
              : formField.value
                ? [String(formField.value)]
                : [""];
            return (
              <div className="space-y-2">
                {currentValues.map((value, index) => (
                  <div key={`${field.name}-time-${index}`} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        type="time"
                        value={toTimeValue(value)}
                        onChange={(event) => {
                          const next = [...currentValues];
                          next[index] = event.target.value;
                          formField.onChange(next);
                        }}
                      />
                      <p className="text-xs text-muted-foreground break-all">
                        {value || field.hint || "HH:mm"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
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
                  onClick={() => formField.onChange([...currentValues, ""])}
                  aria-label="Add value"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            );
          }
          return (
            <div className="space-y-2">
              <Input
                type="time"
                value={toTimeValue(formField.value)}
                onChange={(event) => formField.onChange(event.target.value)}
              />
              <p className="text-xs text-muted-foreground break-all">
                {String(formField.value ?? "") || field.hint || "HH:mm"}
              </p>
            </div>
          );

        case "timerange":
        case "daterange": {
          const inputType = field.widget === "timerange" ? "time" : "date";
          const normalize = field.widget === "timerange" ? toTimeValue : toDateValue;
          if (isMultiple) {
            const currentValues = Array.isArray(formField.value)
              ? formField.value.map((value) => String(value ?? ""))
              : formField.value
                ? [String(formField.value)]
                : [""];
            return (
              <div className="space-y-2">
                {currentValues.map((value, index) => {
                  const [startRaw, endRaw] = parseRangeValue(value);
                  const start = normalize(startRaw);
                  const end = normalize(endRaw);
                  return (
                    <div key={`${field.name}-${field.widget}-${index}`} className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Input
                            type={inputType}
                            value={start}
                            onChange={(event) => {
                              const next = [...currentValues];
                              next[index] = formatRangeValue(event.target.value, end);
                              formField.onChange(next);
                            }}
                          />
                          <Input
                            type={inputType}
                            value={end}
                            onChange={(event) => {
                              const next = [...currentValues];
                              next[index] = formatRangeValue(start, event.target.value);
                              formField.onChange(next);
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground break-all">
                          {value ||
                            field.hint ||
                            (field.widget === "timerange"
                              ? "HH:mm - HH:mm"
                              : "YYYY-MM-DD - YYYY-MM-DD")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                          formField.onChange(next.length ? next : []);
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
                  onClick={() => formField.onChange([...currentValues, ""])}
                  aria-label="Add value"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            );
          }
          const [startRaw, endRaw] = parseRangeValue(formField.value);
          const start = normalize(startRaw);
          const end = normalize(endRaw);
          return (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  type={inputType}
                  value={start}
                  onChange={(event) => formField.onChange(formatRangeValue(event.target.value, end))}
                />
                <Input
                  type={inputType}
                  value={end}
                  onChange={(event) => formField.onChange(formatRangeValue(start, event.target.value))}
                />
              </div>
              <p className="text-xs text-muted-foreground break-all">
                {String(formField.value ?? "") ||
                  field.hint ||
                  (field.widget === "timerange"
                    ? "HH:mm - HH:mm"
                    : "YYYY-MM-DD - YYYY-MM-DD")}
              </p>
            </div>
          );
        }
    
        case "number":
          return (
            <Input
              type="number"
              placeholder={field.hint}
              {...formField}
              onChange={(e) => formField.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)}
              value={formField.value === undefined ? '' : formField.value} // Handle undefined values
            />
          );

        case "tag":
          if (isMultiple) {
            return (
              <TagsInput
                value={Array.isArray(formField.value) ? formField.value.map((v) => String(v)) : []}
                onChange={(next) => formField.onChange(next)}
                placeholder={field.hint || "Type and press Enter"}
              />
            );
          }
          return (
            <TagsInput
              value={
                formField.value
                  ? [String(Array.isArray(formField.value) ? formField.value[0] ?? "" : formField.value)]
                  : []
              }
              onChange={(next) => formField.onChange(next[0] ?? "")}
              placeholder={field.hint || "Type and press Enter"}
            />
          );
    
        case "select":
          const sourceMeta = getSourceFieldMeta(field);
          const sourceSpec = parseBlueprintSourceSpec(field.source);
          const searchedOptions = sourceSearchOptionsByField[field.name] ?? {};
          const options = { ...resolveSelectOptions(), ...searchedOptions };
          const searchEnabled = Boolean(sourceSpec);
          const searchQuery = sourceSearchDraftByField[field.name] ?? "";
          const searchLoading = sourceSearchLoadingByField[field.name] ?? false;
          const searchError = sourceSearchErrorByField[field.name] ?? "";
          const currentRawValues = isMultiple
            ? Array.isArray(formField.value)
              ? formField.value
              : formField.value == null || formField.value === ""
                ? []
                : [formField.value]
            : [formField.value];
          const currentValues = currentRawValues.map((entry) =>
            sourceMeta ? extractReferenceId(entry) : String(entry ?? ""),
          );
          const normalizedValues = currentValues.length > 0 ? currentValues : [""];
          if (Object.keys(options).length > 0) {
            return (
              <div className="space-y-2">
                {normalizedValues.map((entryValue, index) => {
                  const sourceOverride = sourceMeta
                    ? getSourceOverrideAt(sourceOverrides, field.name, index, sourceMeta)
                    : null;
                  return (
                    <div key={`${field.name}-select-${index}`} className="space-y-2 rounded-md border p-2">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-2">
                          <SearchableSelect
                            options={options}
                            value={entryValue}
                            onChange={(next) => {
                              const nextValues = [...normalizedValues];
                              nextValues[index] = String(Array.isArray(next) ? next[0] ?? "" : next);
                              formField.onChange(isMultiple ? nextValues : nextValues[0] ?? "");
                            }}
                            multiple={false}
                            placeholder={field.hint}
                            allowEmpty={!field.required}
                            emptyLabel="None"
                            searchQuery={searchEnabled ? searchQuery : undefined}
                            onSearchQueryChange={searchEnabled
                              ? (value) =>
                                  setSourceSearchDraftByField((prev) => ({ ...prev, [field.name]: value }))
                              : undefined}
                            onSearch={searchEnabled ? () => void runSourceSearch(field) : undefined}
                            searching={searchEnabled ? searchLoading : undefined}
                            searchError={searchEnabled ? searchError : undefined}
                            searchPlaceholder={searchEnabled ? `Search ${sourceSpec?.target}` : undefined}
                          />
                          {sourceMeta && sourceOverride ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="outline" size="icon" aria-label="Relationship details">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-96 space-y-3" align="start">
                                <p className="text-xs text-muted-foreground">Override this reference labels and qualifiers.</p>
                                <div className="grid gap-2">
                                  <Label htmlFor={`${field.name}-${index}-label-forward`} className="text-xs">Forward label</Label>
                                  <Input
                                    id={`${field.name}-${index}-label-forward`}
                                    value={sourceOverride.labelForward}
                                    onChange={(event) =>
                                      setSourceOverrides((prev) => {
                                        const fieldOverrides = [...(prev[field.name] ?? [])];
                                        fieldOverrides[index] = {
                                          ...sourceOverride,
                                          labelForward: event.target.value,
                                        };
                                        return { ...prev, [field.name]: fieldOverrides };
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor={`${field.name}-${index}-label-backward`} className="text-xs">Backward label</Label>
                                  <Input
                                    id={`${field.name}-${index}-label-backward`}
                                    value={sourceOverride.labelBackward}
                                    onChange={(event) =>
                                      setSourceOverrides((prev) => {
                                        const fieldOverrides = [...(prev[field.name] ?? [])];
                                        fieldOverrides[index] = {
                                          ...sourceOverride,
                                          labelBackward: event.target.value,
                                        };
                                        return { ...prev, [field.name]: fieldOverrides };
                                      })
                                    }
                                  />
                                </div>
                                {sourceMeta.qualifierKeys.map((qualifierKey) => (
                                  <div key={`${field.name}-${index}-qualifier-${qualifierKey}`} className="grid gap-2">
                                    <Label htmlFor={`${field.name}-${index}-qualifier-${qualifierKey}`} className="text-xs">
                                      Qualifier: {qualifierKey}
                                    </Label>
                                    <Input
                                      id={`${field.name}-${index}-qualifier-${qualifierKey}`}
                                      value={sourceOverride.qualifiers[qualifierKey] ?? ""}
                                      onChange={(event) =>
                                        setSourceOverrides((prev) => {
                                          const fieldOverrides = [...(prev[field.name] ?? [])];
                                          fieldOverrides[index] = {
                                            ...sourceOverride,
                                            qualifiers: {
                                              ...sourceOverride.qualifiers,
                                              [qualifierKey]: event.target.value,
                                            },
                                          };
                                          return { ...prev, [field.name]: fieldOverrides };
                                        })
                                      }
                                    />
                                  </div>
                                ))}
                              </PopoverContent>
                            </Popover>
                          ) : null}
                        </div>
                        {isMultiple && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              const nextValues = normalizedValues.filter((_, valueIndex) => valueIndex !== index);
                              formField.onChange(nextValues.length > 0 ? nextValues : [""]);
                              if (sourceMeta) {
                                setSourceOverrides((prev) => {
                                  const fieldOverrides = [...(prev[field.name] ?? [])];
                                  fieldOverrides.splice(index, 1);
                                  return { ...prev, [field.name]: fieldOverrides };
                                });
                              }
                            }}
                            aria-label="Remove relationship"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {sourceMeta && sourceOverride ? (
                        <p className="text-xs text-muted-foreground">
                          {formatSourceOverrideHint(sourceOverride, sourceMeta.qualifierKeys)}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                {isMultiple && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => formField.onChange([...(normalizedValues ?? []), ""])}
                    aria-label="Add relationship"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          }
          return (
            <div className="space-y-2">
              <Select onValueChange={formField.onChange} value={formField.value}>
                <SelectTrigger>
                  <SelectValue placeholder={field.hint} />
                </SelectTrigger>
                <SelectContent>
                  {field.options && !isCascadeOptions(field.options) ? (
                    Object.entries(field.options).map(([value, label]) => (
                      <SelectItem key={value} value={value.includes(':') ? value.split(':')[1] : value}>
                        {label}
                      </SelectItem>
                    ))
                  ) : (
                    (() => {
                      const sourceSpec = parseBlueprintSourceSpec(field.source);
                      const richKey = sourceSpec?.target ?? "";
                      return Rich[richKey] ? (
                        <>
                          {Object.entries(Rich[richKey]).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </>
                      ) : (
                        <SelectItem key='x' value='0'>No options</SelectItem>
                      );
                    })()
                  )}
                </SelectContent>
              </Select>
            </div>
          );

        case "select-cascade": {
          const sourceName = typeof field.source === "string" ? field.source : "";
          const sourceValue = form.watch(sourceName) as string | undefined;
          const cascadeOptions = field.options as Record<string, Record<string, string>> | undefined;
          const innerOptions: Record<string, string> = (sourceValue && cascadeOptions && cascadeOptions[sourceValue])
            ? cascadeOptions[sourceValue]
            : {};
          const placeholder = !sourceValue
            ? `Select ${sourceName} first`
            : (field.hint ?? 'Select...');
          return (
            <Select
              onValueChange={formField.onChange}
              value={innerOptions[formField.value as string] !== undefined ? formField.value : ''}
              disabled={Object.keys(innerOptions).length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(innerOptions).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        case "image":

          return (

            <Input
              type="file"
              placeholder={field.hint}
              accept="image/*" 
              {...formField}
              onChange={(e) => formField.onChange(handleFileChange(e))} // Convert to number
              
            />
          );

    
        // Add more cases for different widget types as needed
    
        default:
          return <Input placeholder={field.hint} {...formField} />;
      }
  }



  useEffect(() => {
      const updateBlueprint = async () => {  
        
          setFields(
            blueprint.fields
              .filter(field => Number(field.layer) <= 0)
              .map(field => ({
                ...field,
                type: field.type as "string" | "number" | "integer" | "float" | "timestamp" | "array" | "object",
                widget: field.widget as "number" | "date" | "time" | "datetime" | "timerange" | "daterange" | "select" | "text" | "textarea" | "image" | "select-cascade" | "tag" | "json",
              }))
          );

    
          // Safely set rich if blueprint.rich exists
          console.log('form-post:235')
          console.log(blueprint);
          if (blueprint.rich) {
            console.log('setRich!'); 
            setRich(blueprint.rich);
          }else{
            console.log('Rich did not exist');
          }

      };
  
      updateBlueprint();
  }, [blueprint]);

  

  const FormSchema = generateSchema(Fields);
  const form = useForm<z.infer<typeof FormSchema>>({
      resolver: zodResolver(FormSchema)
  });

  const formValues = form.watch();
  useEffect(() => {
    Fields.filter(f => f.widget === 'select-cascade' && f.source).forEach(f => {
      const srcVal = formValues[f.source as string];
      const inner = (f.options as Record<string, Record<string, string>>)?.[srcVal as string];
      const currentVal = formValues[f.name];
      if (currentVal && inner && !(currentVal in inner)) {
        form.setValue(f.name, '');
      }
    });
  }, [formValues, Fields, form]);


  // Toast
  const { toast } = useToast();

  async function onSubmit(data: z.infer<typeof FormSchema>) {
      // Normalize widget:json values before sending to API.
      for (const field of Fields) {
        if (field.widget !== "json") continue;
        const fieldName = field.name;
        const isMultiple = String(field.cardinality ?? "single").toLowerCase() === "multiple";
        const currentValue = (data as Record<string, unknown>)[fieldName];
        try {
          if (isMultiple) {
            const rawEntries = Array.isArray(currentValue)
              ? currentValue
              : currentValue == null || currentValue === ""
                ? []
                : [currentValue];
            (data as Record<string, unknown>)[fieldName] = rawEntries.map((entry) =>
              parseJsonEditorValue(entry, field.type),
            );
          } else {
            (data as Record<string, unknown>)[fieldName] = parseJsonEditorValue(currentValue, field.type);
          }
        } catch {
          toast({
            title: "Invalid JSON",
            description: `${field.label || field.name}: invalid JSON format.`,
            variant: "destructive",
          });
          return;
        }
      }

      // Normalize source-governed references to object payloads.
      for (const field of Fields) {
        const sourceMeta = getSourceFieldMeta(field);
        if (!sourceMeta) continue;
        const fieldName = field.name;
        const overrideList = sourceOverrides[fieldName] ?? [];
        const currentValue = (data as Record<string, unknown>)[fieldName];
        const isMultiple = String(field.cardinality ?? "single").toLowerCase() === "multiple";
        if (isMultiple) {
          const values = Array.isArray(currentValue)
            ? currentValue
            : currentValue == null || currentValue === ""
              ? []
              : [currentValue];
          (data as Record<string, unknown>)[fieldName] = values
            .map((entry, index) =>
              buildSourceReferenceObject(
                entry,
                sourceMeta,
                overrideList[index] ?? defaultSourceOverride(sourceMeta),
              ),
            )
            .filter((entry): entry is Record<string, unknown> => entry !== null);
        } else {
          if (currentValue == null || currentValue === "") continue;
          const referenceObject = buildSourceReferenceObject(
            currentValue,
            sourceMeta,
            overrideList[0] ?? defaultSourceOverride(sourceMeta),
          );
          (data as Record<string, unknown>)[fieldName] = referenceObject ?? "";
        }
      }



      toast({
      title: "You submitted the following values:",
      description: (
          <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
          </pre>
      ),
      });

      
      console.log('Posting ...');
      console.log(data);

      try {

          // Step 1:  Upload File if it exist
          if(file) {

            console.log('Uploading image:')
            console.log(file)

            const formData = new FormData();
            formData.append("up_file", file, file.name);
            formData.append("up_file_type", file.type);
            
            // Append the image file if it exists
            
            //const imageField = data.image; // Assuming 'image' is the name of your file input
            //if (imageField && imageField.length > 0) {
            //    formData.append('image', imageField[0]); // Append the first file
            //}

            const upload_path = path.replace(/_data/g, "_docs");

            // Post the data to your server or API endpoint
            const uploadResponse = await fetch(upload_path, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${sessionStorage.accessToken}`,
              },
              body: formData, // Send FormData instead of JSON
            });

            if (!uploadResponse.ok) {
              throw new Error('File upload failed');
            }
    
            const uploadResult = await uploadResponse.json();

            data['imageurl'] = uploadResult.path


          }


          // Step 2: Submit form with file URL
          // Post the data to your server or API endpoint

          console.log('Posting Form:');
          console.log(data);


          const response = await fetch(path, {
            method: method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionStorage.accessToken}`,
            },
            body: JSON.stringify(data),
          });
    
          // Handle the response
          if (response.ok) {
            console.log('Data submitted successfully!');
            toast({
              title: "Data submitted successfully",
              description: (
                  <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
                  <code className="text-white">Data submitted successfully!</code>
                  </pre>
              ),
            });
            
            loadTree();
            refreshUp();
            

          } else {
            console.error('Failed to submit the data.');
            toast({
              title: "Failed to submit the data.",
              description: (
                  <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
                  <code className="text-white">Failed to submit the form.</code>
                  </pre>
              ),
            });
          }
        } catch (error) {
          console.error('Error:', error);
          toast({
              title: "Failed to submit the data.",
              description: (
                  <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
                  <code className="text-white">Error!</code>
                  </pre>
              ),
            });
      }
  }

  // Component
  return (
      <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
          {Fields.map((field) => (
          
          <FormField
              key={field.id}
              control={form.control}
              name={field.name}
              render={({ field: formField }) => (
              <FormItem className="px-1">
                  <FormLabel>{field.label}{field.required ? '*' : ''}</FormLabel>
                  <FormControl>{renderFormField(field, formField, Rich, form)}</FormControl>
                  <FormDescription>{/*<span className='text-xs'>{field.hint}</span>*/}</FormDescription>
                  <FormMessage />
              </FormItem>
              )}
          />
          
          ))}
          {!hideSubmitButton && <Button key="submit" type="submit">Save</Button>}
      </form>
      </Form>
  );
}