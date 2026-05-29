import { useState,useEffect,useContext } from 'react';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChevronsUpDown } from "lucide-react";

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; // Get the uploaded file
    if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
      console.log("setting new file");
      setFile(file); // Store the file for uploading via FormData
    } else {
      alert("Please upload a valid image file");
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
                  <div key={`${field.name}-${index}`} className="flex gap-2">
                    <Input
                      placeholder={field.hint}
                      value={value}
                      onChange={(event) => {
                        const next = [...currentValues];
                        next[index] = event.target.value;
                        formField.onChange(next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
                      }}
                    >
                      -
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => formField.onChange([...currentValues, ""])}
                >
                  Add value
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
                  <div key={`${field.name}-textarea-${index}`} className="space-y-2">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
                      }}
                    >
                      -
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => formField.onChange([...currentValues, ""])}
                >
                  Add value
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
                  <div key={`${field.name}-datetime-${index}`} className="space-y-2">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
                      }}
                    >
                      -
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => formField.onChange([...currentValues, ""])}
                >
                  Add value
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
                  <div key={`${field.name}-json-${index}`} className="space-y-2">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
                      }}
                    >
                      -
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => formField.onChange([...currentValues, ""])}
                >
                  Add value
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
                  <div key={`${field.name}-date-${index}`} className="space-y-2">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
                      }}
                    >
                      -
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => formField.onChange([...currentValues, ""])}
                >
                  Add value
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
                  <div key={`${field.name}-time-${index}`} className="space-y-2">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                        formField.onChange(next.length ? next : []);
                      }}
                    >
                      -
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => formField.onChange([...currentValues, ""])}
                >
                  Add value
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
                    <div key={`${field.name}-${field.widget}-${index}`} className="space-y-2">
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const next = currentValues.filter((_, valueIndex) => valueIndex !== index);
                          formField.onChange(next.length ? next : []);
                        }}
                      >
                        -
                      </Button>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => formField.onChange([...currentValues, ""])}
                >
                  Add value
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
          if (isMultiple) {
            const options = resolveSelectOptions();
            return (
              <SearchableSelect
                options={options}
                value={formField.value}
                onChange={(next) => formField.onChange(next)}
                multiple
                placeholder={field.hint}
              />
            );
          }
          const options = resolveSelectOptions();
          if (Object.keys(options).length > 0) {
            return (
              <SearchableSelect
                options={options}
                value={formField.value}
                onChange={(next) => formField.onChange(next)}
                multiple={false}
                placeholder={field.hint}
                allowEmpty={!field.required}
                emptyLabel="None"
              />
            );
          }
          return (
            <Select onValueChange={formField.onChange} value={formField.value}>
              <SelectTrigger>
                <SelectValue placeholder={field.hint} />
              </SelectTrigger>
  
  
              <SelectContent>
          
                {field.options && !isCascadeOptions(field.options) ? (
                  // If field.options exist, map over the options and display SelectItem components
                  Object.entries(field.options).map(([value, label]) => (
                    <SelectItem key={value} value={value.includes(':') ? value.split(':')[1] : value}>
                      {label}
                    </SelectItem>
                  ))
                ) : (
                  // Else, check if field.rich[field.source.split(':')[1]] exists
                  
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