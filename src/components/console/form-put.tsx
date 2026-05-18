import { useState, useEffect, useContext, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { GlobalContext } from "@/components/console/global-context";

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

type EditState =
  | { kind: "string"; text: string; multiline: boolean }
  | { kind: "number"; text: string }
  | { kind: "boolean"; on: boolean }
  | { kind: "json"; text: string }
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
  const sourceRaw = field?.source;
  if (typeof sourceRaw !== "string" || sourceRaw.length === 0) return null;
  const sourceKey = sourceRaw.split(":")[0];
  const richMap = blueprint?.rich?.[sourceKey];
  if (!richMap || typeof richMap !== "object" || Array.isArray(richMap)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(richMap)) {
    if (typeof k !== "string" || !k) continue;
    out[k] = typeof v === "string" ? v : v == null ? "" : String(v);
  }
  return Object.keys(out).length > 0 ? out : null;
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

  const optionMap = parseFieldOptions(field) ?? parseSourceOptions(field, blueprint);
  if (optionMap) {
    let raw =
      selectedValue === null || selectedValue === undefined
        ? ""
        : String(selectedValue);
    if (!raw) {
      const def = field?.default;
      if (typeof def === "string" && def) raw = def;
    }
    const valueKey = resolveEnumStoredKey(raw, optionMap);
    const merged = { ...optionMap };
    if (valueKey && !(valueKey in merged)) {
      merged[valueKey] = valueKey;
    }
    const required =
      field?.required === true || field?.required === "true";
    const allowEmpty = !required;
    return { kind: "enum", valueKey, options: merged, allowEmpty };
  }

  const multiline = widget === "textarea";
  if (selectedValue === null || selectedValue === undefined) {
    return { kind: "string", text: "", multiline };
  }
  return { kind: "string", text: String(selectedValue), multiline };
}

function valueFromEditState(state: EditState, fieldKey: string): Record<string, unknown> {
  switch (state.kind) {
    case "string":
      return { [fieldKey]: state.text };
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
    case "boolean":
      return { [fieldKey]: state.on };
    case "enum":
      return { [fieldKey]: enumOptionKeyToStoredValue(state.valueKey) };
    case "json": {
      try {
        const parsed = JSON.parse(state.text) as unknown;
        return { [fieldKey]: parsed };
      } catch {
        throw new Error("Invalid JSON — check brackets, commas, and quotes.");
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
  const label =
    (typeof field?.label === "string" && field.label) || selectedKey;
  const typeHint =
    typeof field?.type === "string" ? field.type : undefined;

  useEffect(() => {
    setState(buildEditState(selectedKey, selectedValue, blueprint));
  }, [selectedKey, selectedValue, blueprint]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      state.kind === "enum" &&
      !state.allowEmpty &&
      state.valueKey === ""
    ) {
      toast({
        title: "Required",
        description: "Please select a value for this field.",
        variant: "destructive",
      });
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = valueFromEditState(state, selectedKey);
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
      : state.kind === "number"
        ? "Numeric value."
        : state.kind === "boolean"
          ? "Toggle on or off."
          : state.kind === "enum"
            ? "Choose one of the predefined values."
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

      {state.kind === "enum" && (
        <Select
          value={
            state.valueKey === "" && state.allowEmpty
              ? ENUM_EMPTY_VALUE
              : state.valueKey || undefined
          }
          onValueChange={(v) => {
            const valueKey = v === ENUM_EMPTY_VALUE ? "" : v;
            setState({
              kind: "enum",
              valueKey,
              options: state.options,
              allowEmpty: state.allowEmpty,
            });
          }}
        >
          <SelectTrigger
            id={`put-${selectedKey}`}
            className="w-full"
            aria-label={label}
          >
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            {state.allowEmpty && (
              <SelectItem value={ENUM_EMPTY_VALUE}>— None —</SelectItem>
            )}
            {Object.entries(state.options).map(([k, optLabel]) => (
              <SelectItem key={k} value={k}>
                {optLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {!hideSubmitButton && <Button type="submit">Save</Button>}
    </form>
  );
}
