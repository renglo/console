import {
    Copy,
    GitBranch,
    Lock,
    MoreVertical,
    RefreshCw,
    Pyramid,
    Search,
} from "lucide-react"
  

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useEffect, useMemo } from 'react';
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import DialogPut from '@/components/console/dialog-put'
import { formatBlueprintFieldValue } from "@/lib/blueprint-field-display"
import { fileNameFromUri, storedFileHref } from "@/lib/image-upload"
import RadialGraph from "@/components/console/radial-graph"
import { buildNodeEdgesRadialGraphModel } from "@/components/console/radial-graph-models"
import {
  getBlueprintIndexPathFieldSet,
  parseBlueprintSourceSpec,
  resolveDocumentTitle,
} from "@/lib/console_utils"
import {
  fieldGraphRole,
  fieldIsEmbedded,
  fieldIsSearchable,
  positiveLevel,
} from "@/lib/blueprint-spec"


interface ItemPreviewProps { 
  selectedId: string;            
  refreshUp: () => void;         
  onDeleteId: (id: string) => void; 
  blueprint?: any;
  portfolio: string;
  org: string;
  ring: string;               
}


interface DataType {
  name?: string;
  _id?: string;
  [key: string]: any; // Additional properties
}

interface FieldDictionary {
  [key: string]: {
    widget?: string;
    hint?: string;
    label?: string;
    cardinality?: string;
    type?: string;
    source?: unknown;
    embed?: unknown;
    search?: unknown;
    literal_edge?: unknown;
  };
}

interface BlueprintField {
  name: string;
  widget?: string;
  hint?: string;
  label?: string;
  cardinality?: string;
  type?: string;
  source?: unknown;
  edges?: [string, string];
  embed?: unknown;
  search?: unknown;
  literal_edge?: unknown;
}

interface EdgeDefinition {
  edgeType: string;
  outgoingAlias?: string;
  incomingAlias?: string;
}

function stringifyEmbedValue(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === "boolean") return [String(raw).toLowerCase()];
  if (typeof raw === "number") return [String(raw)];
  if (typeof raw === "string") {
    const text = raw.trim();
    return text ? [text] : [];
  }
  if (Array.isArray(raw)) {
    const values: string[] = [];
    for (const item of raw) {
      for (const part of stringifyEmbedValue(item)) {
        if (!values.includes(part)) values.push(part);
      }
    }
    return values;
  }
  if (typeof raw === "object" && raw && "value" in raw) {
    return stringifyEmbedValue((raw as { value?: unknown }).value);
  }
  const text = String(raw).trim();
  return text ? [text] : [];
}

function buildLiveFingerprint(
  fieldsDictionary: FieldDictionary,
  data: DataType,
  blueprint: unknown,
): { text: string; fields: string[] } {
  const used: string[] = [];
  const parts: string[] = [];
  for (const [name, field] of Object.entries(fieldsDictionary)) {
    if (!fieldIsEmbedded(field, blueprint)) continue;
    const values = stringifyEmbedValue(data[name] ?? data?.attributes?.[name]);
    if (values.length === 0) continue;
    parts.push(`[${name}=${values.join(",")}]`);
    used.push(name);
  }
  return { text: parts.join(" "), fields: used };
}

function previewEmbedding(vector: unknown, limit = 8): string {
  if (!Array.isArray(vector) || vector.length === 0) return "—";
  const head = vector.slice(0, limit).map((n) => {
    const num = Number(n);
    return Number.isFinite(num) ? num.toFixed(4) : String(n);
  });
  const suffix = vector.length > limit ? `, … +${vector.length - limit}` : "";
  return `[${head.join(", ")}${suffix}]`;
}

function toUpperSnake(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export default function ItemPreview({selectedId,refreshUp,onDeleteId,blueprint,portfolio,org,ring}: ItemPreviewProps) {


    //const [data, setData] = useState({}); // State to hold table data
    const [data, setData] = useState<DataType>({});

    //const [loading, setLoading] = useState(true); // State to manage loading status
    const [, setError] = useState<Error | null>(null);
    const [refresh, setRefresh] = useState(false);
    const [showCard, setShowCard] = useState(true);
    const [fieldsDictionary, setFieldsDictionary] = useState<FieldDictionary>({});
    const [graphDialogOpen, setGraphDialogOpen] = useState(false);
    const [graphLoading, setGraphLoading] = useState(false);
    const [graphError, setGraphError] = useState("");
    const [graphResponse, setGraphResponse] = useState<any>(null);
    const [inferredEdgeDefinitions, setInferredEdgeDefinitions] = useState<EdgeDefinition[]>([]);
    const [vectorDialogOpen, setVectorDialogOpen] = useState(false);
    const [vectorLoading, setVectorLoading] = useState(false);
    const [vectorError, setVectorError] = useState("");
    const [vectorResponse, setVectorResponse] = useState<any>(null);
    const [showFullEmbedding, setShowFullEmbedding] = useState(false);

    const indexPathFields = useMemo(
        () => getBlueprintIndexPathFieldSet(blueprint),
        [blueprint],
    );

    const radialModel = useMemo(
      () => buildNodeEdgesRadialGraphModel(graphResponse, `${ring}/${selectedId || ""}`),
      [graphResponse, ring, selectedId],
    );

    const liveFingerprint = useMemo(
      () => buildLiveFingerprint(fieldsDictionary, data, blueprint),
      [fieldsDictionary, data, blueprint],
    );

    const embedFieldNames = useMemo(
      () =>
        Object.entries(fieldsDictionary)
          .filter(([, field]) => fieldIsEmbedded(field, blueprint))
          .map(([name]) => name),
      [fieldsDictionary, blueprint],
    );

    useEffect(() => {
        if (!selectedId) {
            setData({});
            setShowCard(false);
            setVectorResponse(null);
            setVectorError("");
            return;
        }

        const fetchData = async () => {
            try {
            const dataResponse = await fetch(`${import.meta.env.VITE_API_URL}/_data/${portfolio}/${org}/${ring}/${encodeURIComponent(selectedId)}`, {
                method: 'GET',
                headers: {
                'Authorization': `Bearer ${sessionStorage.accessToken}`,
                },
            });
            const response = await dataResponse.json();
            setData(response);
            setShowCard(true);
            } catch (err) {
              if (err instanceof Error) {
                setError(err);
              } else {
                setError(new Error("An unknown error occurred"));
              }
            }
        };

        void fetchData();
    }, [selectedId, portfolio, org, ring, refresh]);


    useEffect(() => {
        // Iterate through blueprint.fields and generate a dictionary where the key is the name and the content is the field object itself
        const dictionary: FieldDictionary = {};
        if (blueprint && blueprint.fields) {
            blueprint.fields.forEach((field: BlueprintField) => {
                dictionary[field.name] = field;
            });
        }
        setFieldsDictionary(dictionary);
    }, [blueprint]);




      
    // Function to update the state
    const refreshAction = () => {
        setRefresh(prev => !prev); // Toggle the `refresh` state to trigger useEffect
        refreshUp();

    };


    const handleDeleteId = (id: string) => {
      
      onDeleteId(id)
      setData({});
      setShowCard(false);
      
    };

    const renderFieldValue = (fieldInfo: FieldDictionary[string] | undefined, key: string, value: unknown) => {
      const cardinality = String(fieldInfo?.cardinality ?? "single").toLowerCase();
      const fieldType = String(fieldInfo?.type ?? "").toLowerCase();
      const isMulti = cardinality === "multiple" || cardinality === "plural" || cardinality === "multi";
      const isMultiText =
        isMulti &&
        (fieldInfo?.widget === "text" || fieldInfo?.widget === "textarea") &&
        (fieldType === "string" || fieldType === "text");
      const isJsonWidget = fieldInfo?.widget === "json";
      const isImageWidget = fieldInfo?.widget === "image";
      const isDocumentWidget = fieldInfo?.widget === "document";

      if (isImageWidget) {
        const uris = Array.isArray(value)
          ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean)
          : value == null || value === ""
            ? []
            : [String(value).trim()].filter(Boolean);
        if (uris.length === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-3">
            {uris.map((uri, index) => {
              const src = storedFileHref(uri);
              if (!src) return null;
              return (
                <img
                  key={`${key}-preview-image-${index}`}
                  src={src}
                  alt={`${fieldInfo?.label || key} ${index + 1}`}
                  className="max-h-48 max-w-full rounded-md object-contain"
                />
              );
            })}
          </div>
        );
      }

      if (isDocumentWidget) {
        const uris = Array.isArray(value)
          ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean)
          : value == null || value === ""
            ? []
            : [String(value).trim()].filter(Boolean);
        if (uris.length === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-col gap-2">
            {uris.map((uri, index) => {
              const href = storedFileHref(uri);
              if (!href) return null;
              return (
                <a
                  key={`${key}-preview-document-${index}`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline break-all"
                >
                  {fileNameFromUri(uri) || `${fieldInfo?.label || key} ${index + 1}`}
                </a>
              );
            })}
          </div>
        );
      }

      if (isJsonWidget) {
        const formatJson = (entry: unknown) => {
          if (entry === null || entry === undefined) return "";
          if (typeof entry === "string") {
            const trimmed = entry.trim();
            if (!trimmed) return "";
            try {
              return JSON.stringify(JSON.parse(trimmed), null, 2);
            } catch {
              return entry;
            }
          }
          try {
            return JSON.stringify(entry, null, 2);
          } catch {
            return String(entry);
          }
        };

        if (isMulti) {
          const values = Array.isArray(value) ? value : value == null ? [] : [value];
          if (values.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="space-y-2">
              {values.map((entry, index) => (
                <Textarea
                  key={`${key}-preview-json-${index}`}
                  value={formatJson(entry)}
                  readOnly
                  disabled
                  rows={8}
                  className="bg-muted/20 font-mono text-xs leading-relaxed"
                />
              ))}
            </div>
          );
        }

        return (
          <Textarea
            value={formatJson(value)}
            readOnly
            disabled
            rows={10}
            className="bg-muted/20 font-mono text-xs leading-relaxed"
          />
        );
      }

      if (isMultiText) {
        const values = Array.isArray(value)
          ? value.map((entry) => String(entry ?? ""))
          : value == null
            ? []
            : [String(value)];
        if (values.length === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="space-y-2">
            {values.map((entry, index) => (
              fieldInfo?.widget === "textarea" ? (
                <Textarea
                  key={`${key}-preview-textarea-${index}`}
                  value={entry}
                  readOnly
                  disabled
                  rows={4}
                  className="bg-muted/20"
                />
              ) : (
                <Input
                  key={`${key}-preview-${index}`}
                  value={entry}
                  readOnly
                  disabled
                  className="bg-muted/20"
                />
              )
            ))}
          </div>
        );
      }

      const sourceSpec = parseBlueprintSourceSpec(fieldInfo?.source);
      if (sourceSpec) {
        const entries = Array.isArray(value) ? value : value == null ? [] : [value];
        const richMap = blueprint?.rich?.[sourceSpec.target] ?? {};
        const resolveReferenceId = (entry: unknown): string => {
          if (entry == null) return "";
          if (typeof entry === "object" && !Array.isArray(entry)) {
            const ref = entry as Record<string, unknown>;
            const target = ref.target;
            const targetObj = target && typeof target === "object" && !Array.isArray(target)
              ? (target as Record<string, unknown>)
              : undefined;
            const candidate =
              ref.value ??
              ref.id ??
              ref._id ??
              targetObj?.value ??
              targetObj?.id ??
              targetObj?._id;
            return candidate == null ? "" : String(candidate).trim();
          }
          return String(entry).trim();
        };

        const resolveReferenceLabel = (entry: unknown): string => {
          const refId = resolveReferenceId(entry);
          if (refId && richMap && typeof richMap === "object" && refId in richMap) {
            return String(richMap[refId]);
          }
          if (entry && typeof entry === "object" && !Array.isArray(entry) && sourceSpec.targetLabelFields.length > 0) {
            const ref = entry as Record<string, unknown>;
            const target = ref.target;
            const targetObj = target && typeof target === "object" && !Array.isArray(target)
              ? (target as Record<string, unknown>)
              : undefined;
            const parts = sourceSpec.targetLabelFields
              .map((fieldName) => {
                const direct = ref[fieldName];
                const nested = targetObj?.[fieldName];
                const candidate = direct ?? nested;
                return candidate == null ? "" : String(candidate).trim();
              })
              .filter((part) => part.length > 0);
            if (parts.length > 0) {
              return parts.join(", ");
            }
          }
          return refId;
        };

        const labels = entries
          .map((entry) => resolveReferenceLabel(entry))
          .filter((label) => label.length > 0);

        if (labels.length === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <span className="break-words [overflow-wrap:anywhere]">
            {labels.join(", ")}
          </span>
        );
      }

      return formatBlueprintFieldValue(value, key, blueprint);
    };

    const inferEdgeDefinitionsFromBlueprint = (): EdgeDefinition[] => {
      if (blueprint?.enable_graph === false) {
        return [];
      }
      const fromBlueprint = typeof blueprint?.name === "string" ? blueprint.name : ring;
      const indexes = (blueprint as { indexes?: { path?: unknown[] } } | undefined)?.indexes;
      const idField =
        Array.isArray(indexes?.path) && indexes.path.length > 0
          ? String(indexes.path[0] ?? "_id").trim() || "_id"
          : "_id";
      const edgeMap = new Map<string, EdgeDefinition>();
      for (const field of blueprint?.fields || []) {
        if (!field || typeof field !== "object" || field.name === undefined || field.name === null) {
          continue;
        }
        const fieldName = String(field.name);
        const sourceSpec = parseBlueprintSourceSpec(field.source);
        if (sourceSpec) {
          const implicitEdgeType = `${fromBlueprint}:${fieldName}:${sourceSpec.target}:_id`;
          const sourceLabels =
            field.source && typeof field.source === "object" && !Array.isArray(field.source)
              ? (field.source as Record<string, unknown>).label
              : undefined;
          const sourceAliases = Array.isArray(sourceLabels)
            ? [sourceLabels[0], sourceLabels[1]]
            : [];
          const aliases = Array.isArray(field.edges) && field.edges.length > 0 ? field.edges : sourceAliases;
          const current = edgeMap.get(implicitEdgeType) || { edgeType: implicitEdgeType };
          if (!current.outgoingAlias && typeof aliases[0] === "string") {
            current.outgoingAlias = aliases[0];
          }
          if (!current.incomingAlias && typeof aliases[1] === "string") {
            current.incomingAlias = aliases[1];
          }
          edgeMap.set(implicitEdgeType, current);
        }

        const literalEnabledRaw = (field as Record<string, unknown>).literal_edge;
        const literalEnabled =
          literalEnabledRaw === true ||
          (typeof literalEnabledRaw === "string" &&
            ["1", "true", "yes", "y", "on"].includes(literalEnabledRaw.trim().toLowerCase()));
        if (literalEnabled) {
          const edgeType = `${fromBlueprint}:${idField}:_literal:${fieldName}`;
          const current = edgeMap.get(edgeType) || { edgeType };
          if (!current.outgoingAlias) {
            current.outgoingAlias = `HAS_${toUpperSnake(fieldName)}`;
          }
          edgeMap.set(edgeType, current);
        }
      }
      return Array.from(edgeMap.values());
    };

    const runGraphEdgeQuery = async () => {
      if (!selectedId) return;
      setGraphLoading(true);
      setGraphError("");
      setGraphResponse(null);
      try {
        const inferred = inferEdgeDefinitionsFromBlueprint();
        setInferredEdgeDefinitions(inferred);
        const url = `${import.meta.env.VITE_API_URL}/_graph/${portfolio}/${org}/node-edges`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionStorage.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            node_id: `${ring}/${selectedId}`,
            edge_types: inferred.map((item) => item.edgeType),
            limit: 100,
          }),
        });
        const text = await response.text();
        const body = text ? JSON.parse(text) : {};
        if (!response.ok) {
          throw new Error(body?.message || `Graph query failed (${response.status})`);
        }
        setGraphResponse(body);
      } catch (err) {
        setGraphError(err instanceof Error ? err.message : "Unknown graph query error");
      }         finally {
        setGraphLoading(false);
      }
    };

    const runVectorLookup = async () => {
      if (!selectedId) return;
      setVectorLoading(true);
      setVectorError("");
      setVectorResponse(null);
      setShowFullEmbedding(false);
      try {
        const url = `${import.meta.env.VITE_API_URL}/_vector/${portfolio}/${org}/${encodeURIComponent(ring)}/${encodeURIComponent(selectedId)}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sessionStorage.accessToken}`,
          },
        });
        const text = await response.text();
        const body = text ? JSON.parse(text) : {};
        if (!response.ok) {
          throw new Error(body?.error || body?.message || `Vector lookup failed (${response.status})`);
        }
        setVectorResponse(body);
      } catch (err) {
        setVectorError(err instanceof Error ? err.message : "Unknown vector lookup error");
      } finally {
        setVectorLoading(false);
      }
    };

    
    {/*

    // This is a temporary solution for the MVP. Ring names are hardcoded in the code #gross
    function GraphToShow({ name }: { name: string }) {
      let componentToRender;
  
      switch (name) {
          case 'usecase1':
              componentToRender = <GraphTimeseries2 />;
              break;
          case 'usecase2':
              componentToRender = <GraphBarchart />;
              break;
          case 'usecase3':
              componentToRender = <GraphComparisonBar />;
              break;
          case 'usecase4':
              componentToRender = <GraphRadial />;
              break;
          case 'usecase5':
              componentToRender = <GraphWave />;
              break;
          default:j
              componentToRender = <div></div>;
      }
  
      return (   
        <div className="grid gap-3">
          {componentToRender}
        </div>
      );
    }

    */}

    return (

    <>
      <Card
        className="flex min-h-0 flex-1 flex-col"
      > 
        <CardHeader className="flex flex-col gap-3 space-y-0 bg-muted/50">
          <div className="grid min-w-0 w-full gap-0.5">
            <CardTitle className="group flex min-w-0 items-center gap-2 text-lg">
            {(!selectedId || !showCard) ? (
              <span>All</span>
            ) : (
              <span className="min-w-0 break-words font-semibold leading-snug">
                {resolveDocumentTitle(data as Record<string, unknown>, blueprint)}
              </span>
            )}
              
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                disabled={!data._id}
                onClick={() => {
                  if (data._id) void navigator.clipboard.writeText(String(data._id));
                }}
              >
                <Copy className="h-3 w-3" />
                <span className="sr-only">Copy Item ID</span>
              </Button>
            </CardTitle>
            <CardDescription className={`break-all ${(!selectedId || !showCard) ? 'hidden' : ''}`}>
              id: {data._id}
            </CardDescription>
          </div>
          <div className="flex items-start gap-1">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            <Dialog open={graphDialogOpen} onOpenChange={setGraphDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1"
                  disabled={!selectedId || !showCard}
                  onClick={() => {
                    void runGraphEdgeQuery();
                  }}
                >
                  <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                  Graph Edges
                </Button>
              </DialogTrigger>
              <DialogContent className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-3 overflow-hidden">
                <DialogHeader className="shrink-0">
                  <DialogTitle>Graph edges for current item</DialogTitle>
                  <DialogDescription>
                    Node: <code>{ring}/{selectedId || "N/A"}</code>
                  </DialogDescription>
                </DialogHeader>
                <div className="shrink-0 rounded-md border bg-muted/20 p-2 text-xs">
                  <span className="font-medium">Inferred edge types:</span>{" "}
                  {inferredEdgeDefinitions.length > 0
                    ? inferredEdgeDefinitions
                        .map((item) =>
                          item.outgoingAlias || item.incomingAlias
                            ? `${item.edgeType} (${item.outgoingAlias || item.edgeType} / ${item.incomingAlias || item.edgeType})`
                            : item.edgeType,
                        )
                        .join(", ")
                    : "none"}
                </div>
                {graphError ? (
                  <div className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {graphError}
                  </div>
                ) : null}
                <Tabs defaultValue="radial" className="min-h-0 flex-1">
                  <TabsList className="mb-2 w-fit shrink-0">
                    <TabsTrigger value="radial">Radial graph</TabsTrigger>
                    <TabsTrigger value="raw-json">Raw JSON</TabsTrigger>
                  </TabsList>
                  <TabsContent value="radial" className="min-h-0 flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
                    <div className="h-full min-h-0 overflow-auto rounded-md border bg-muted/20 p-3">
                      {graphLoading ? (
                        <div className="text-sm text-muted-foreground">Loading graph edges...</div>
                      ) : graphResponse === null ? (
                        <div className="text-sm text-muted-foreground">No graph query run yet.</div>
                      ) : radialModel.nodes.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No connected incoming/outgoing edges for this node.</div>
                      ) : (
                        <RadialGraph
                          nodes={radialModel.nodes}
                          links={radialModel.links}
                          currentNodeId={radialModel.centerId}
                          ariaLabel="Radial graph for current node edges"
                          edgeColorMode="direction"
                          pillOpacity={0.9}
                          labelAlong={0.72}
                        />
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="raw-json" className="min-h-0 flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
                    <div className="max-h-[65vh] overflow-y-auto rounded-md border bg-muted/20 p-3">
                      <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                        {graphLoading
                          ? "Loading graph edges..."
                          : graphResponse !== null
                            ? JSON.stringify(graphResponse, null, 2)
                            : "No graph query run yet."}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            <Dialog open={vectorDialogOpen} onOpenChange={setVectorDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1"
                  disabled={!selectedId || !showCard}
                  onClick={() => {
                    void runVectorLookup();
                  }}
                >
                  <Pyramid className="mr-1.5 h-3.5 w-3.5" />
                  Vector
                </Button>
              </DialogTrigger>
              <DialogContent className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-3 overflow-hidden">
                <DialogHeader className="shrink-0">
                  <DialogTitle>Vector for current item</DialogTitle>
                  <DialogDescription>
                    Key: <code>{ring}/{selectedId || "N/A"}</code>
                    {embedFieldNames.length > 0
                      ? ` · blueprint embeds ${embedFieldNames.join(", ")}`
                      : " · this blueprint has no embed fields"}
                  </DialogDescription>
                </DialogHeader>
                {vectorError ? (
                  <div className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {vectorError}
                  </div>
                ) : null}
                <Tabs defaultValue="vector" className="min-h-0 flex-1">
                  <TabsList className="mb-2 w-fit shrink-0">
                    <TabsTrigger value="vector">Stored vector</TabsTrigger>
                    <TabsTrigger value="document">Live document</TabsTrigger>
                    <TabsTrigger value="raw-json">Raw JSON</TabsTrigger>
                  </TabsList>
                  <TabsContent value="vector" className="min-h-0 flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
                    <div className="max-h-[65vh] overflow-y-auto rounded-md border bg-muted/20 p-3 text-sm space-y-3">
                      {vectorLoading ? (
                        <div className="text-muted-foreground">Loading vector…</div>
                      ) : vectorResponse == null ? (
                        <div className="text-muted-foreground">No vector lookup run yet.</div>
                      ) : vectorResponse.found === false ? (
                        <div className="text-muted-foreground">
                          No vector is stored for this document yet. Blueprint CRUD embedding
                          writes on save; existing documents are not backfilled until they are
                          PUT again.
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-1 text-xs">
                            <div><span className="font-medium">Index:</span> {String(vectorResponse.index || "—")}</div>
                            <div><span className="font-medium">Updated:</span> {String(vectorResponse.updated_at || "—")}</div>
                            <div><span className="font-medium">Model:</span> {String(vectorResponse.model || "—")}</div>
                            <div><span className="font-medium">Dim:</span> {String(vectorResponse.dim ?? (Array.isArray(vectorResponse.vector) ? vectorResponse.vector.length : "—"))}</div>
                            <div>
                              <span className="font-medium">Stored fields:</span>{" "}
                              {Array.isArray(vectorResponse.attrs?.fields)
                                ? vectorResponse.attrs.fields.join(", ")
                                : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-xs mb-1">Embedding</div>
                            <pre className="whitespace-pre-wrap break-all rounded-md border bg-background/60 p-2 font-mono text-xs leading-relaxed">
                              {showFullEmbedding
                                ? JSON.stringify(vectorResponse.vector ?? [], null, 2)
                                : previewEmbedding(vectorResponse.vector)}
                            </pre>
                            {Array.isArray(vectorResponse.vector) && vectorResponse.vector.length > 8 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="mt-1 h-7 px-2 text-xs"
                                onClick={() => setShowFullEmbedding((prev) => !prev)}
                              >
                                {showFullEmbedding ? "Hide full vector" : "Show full vector"}
                              </Button>
                            ) : null}
                          </div>
                          <div>
                            <div className="font-medium text-xs mb-1">Live fingerprint (from current document)</div>
                            <p className="mb-1 text-xs text-muted-foreground">
                              Fingerprint text is not stored in the Vector DB. This is rebuilt from
                              the live document and current embed fields.
                            </p>
                            <pre className="whitespace-pre-wrap break-words rounded-md border bg-background/60 p-2 font-mono text-xs leading-relaxed">
                              {liveFingerprint.text || "—"}
                            </pre>
                          </div>
                          <div>
                            <div className="font-medium text-xs mb-1">Stored attrs</div>
                            <pre className="whitespace-pre-wrap break-words rounded-md border bg-background/60 p-2 font-mono text-xs leading-relaxed">
                              {JSON.stringify(vectorResponse.attrs || {}, null, 2)}
                            </pre>
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="document" className="min-h-0 flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
                    <div className="max-h-[65vh] overflow-y-auto rounded-md border bg-muted/20 p-3">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Live Dynamo document. The Vector DB stores only the embedding and
                        metadata, not this JSON.
                      </p>
                      <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>
                  <TabsContent value="raw-json" className="min-h-0 flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
                    <div className="max-h-[65vh] overflow-y-auto rounded-md border bg-muted/20 p-3">
                      <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                        {vectorLoading
                          ? "Loading vector..."
                          : vectorResponse !== null
                            ? JSON.stringify(vectorResponse, null, 2)
                            : "No vector lookup run yet."}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-8">
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-gray-300">Export</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!selectedId || !showCard}
                  onClick={refreshAction}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Refresh
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handleDeleteId(selectedId)}
                >Trash</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 text-sm">
          {(!selectedId || !showCard) ? (
                <div className="p-6">
                  <span className="text-muted-foreground">Select an item from the list to see its details</span>
                </div>
              ) : (
                <Tabs defaultValue="friendly" className="flex min-h-0 flex-1 flex-col gap-0">
                  <TabsList className="mx-6 mt-4 w-fit shrink-0">
                    <TabsTrigger value="friendly">Fields</TabsTrigger>
                    <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                  </TabsList>
                  <TabsContent value="friendly" className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4 mt-0 data-[state=inactive]:hidden">
                    <div className="min-w-0">
                      <div className="font-semibold">Item Details</div>
                      <ul className="mt-3 min-w-0 divide-y divide-border/60">
                      {Object.entries(fieldsDictionary).map(([key, fieldInfo]) => {
                          const value = data[key] ?? data?.attributes?.[key];
                          const isIndexKey = indexPathFields.has(key);
                          const isEmbedded = fieldIsEmbedded(fieldInfo, blueprint);
                          const embedWeight = positiveLevel(fieldInfo?.embed, { allowBoolean: true });
                          const isSearchable = fieldIsSearchable(fieldInfo, blueprint);
                          const searchWeight = positiveLevel(fieldInfo?.search);
                          const graphRole = fieldGraphRole(fieldInfo);
                          return !key.startsWith('_') ? (
                              <li
                                  key={key}
                                  className={cn(
                                    "grid min-w-0 grid-cols-1 gap-3 py-3 sm:grid-cols-[minmax(7.5rem,11rem)_minmax(0,1fr)] sm:items-start sm:gap-x-4",
                                    isIndexKey && "rounded-md bg-muted/25 px-2 -mx-2",
                                  )}>
                                  <div className="flex min-w-0 items-center justify-between gap-2 sm:min-h-8 sm:pt-0.5">
                                    <span
                                      className={cn(
                                        "min-w-0 flex-1 text-sm font-medium leading-snug text-muted-foreground inline-flex items-center gap-1.5",
                                        isIndexKey && "text-muted-foreground/80",
                                      )}
                                    >
                                      <span className="min-w-0">{fieldInfo?.label}</span>
                                      <span className="inline-flex shrink-0 items-center gap-1">
                                      {isSearchable ? (
                                        <span
                                          className="inline-flex h-5 items-center text-amber-600 dark:text-amber-400"
                                          title={
                                            searchWeight > 0
                                              ? `Indexed by search (weight ${searchWeight}).`
                                              : "Indexed by search."
                                          }
                                        >
                                          <Search className="h-3.5 w-3.5 opacity-80" aria-hidden />
                                          <span className="sr-only">Indexed by search</span>
                                        </span>
                                      ) : null}
                                      {graphRole ? (
                                        <span
                                          className="inline-flex h-5 items-center text-sky-600 dark:text-sky-400"
                                          title={
                                            graphRole === "reference"
                                              ? "Creates a graph reference edge."
                                              : "Creates a literal graph edge."
                                          }
                                        >
                                          <GitBranch className="h-3.5 w-3.5 opacity-80" aria-hidden />
                                          <span className="sr-only">
                                            {graphRole === "reference" ? "Graph reference" : "Literal graph edge"}
                                          </span>
                                        </span>
                                      ) : null}
                                      {isEmbedded ? (
                                        <span
                                          className="inline-flex h-5 items-center gap-0.5 text-violet-600 dark:text-violet-400"
                                          title={
                                            embedWeight > 1
                                              ? `Included in the Vector DB fingerprint (weight ${embedWeight}).`
                                              : "Included in the Vector DB fingerprint."
                                          }
                                        >
                                          <Pyramid className="h-3.5 w-3.5 opacity-80" aria-hidden />
                                          {embedWeight > 1 ? (
                                            <span className="text-[0.65rem] font-semibold leading-none">
                                              ×{embedWeight}
                                            </span>
                                          ) : null}
                                          <span className="sr-only">Embedded in Vector DB</span>
                                        </span>
                                      ) : null}
                                      </span>
                                    </span>
                                    {isIndexKey ? (
                                      <span
                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground"
                                        title="This field is part of the document index (indexes.path) and cannot be edited."
                                      >
                                        <Lock className="h-4 w-4 opacity-60" aria-hidden />
                                        <span className="sr-only">Index field, not editable</span>
                                      </span>
                                    ) : (
                                      <DialogPut
                                          selectedKey={key}
                                          selectedValue={value}
                                          refreshUp={refreshAction}
                                          blueprint={blueprint}
                                          title="Edit attribute"
                                          instructions="Modify the attribute and click save."
                                          path={`${import.meta.env.VITE_API_URL}/_data/${portfolio}/${org}/${ring}/${selectedId}`}
                                          method='PUT'
                                      />
                                    )}
                                  </div>
                                  <div
                                    className={cn(
                                      "min-w-0 text-foreground",
                                      isIndexKey && "text-muted-foreground",
                                    )}
                                  >
                                    {renderFieldValue(fieldInfo, key, value)}
                                    {isIndexKey && (
                                      <p className="mt-2 text-xs leading-snug text-muted-foreground">
                                        Index key: this value is part of{" "}
                                        <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">
                                          indexes.path
                                        </code>{" "}
                                        and cannot be changed after the document is created.
                                      </p>
                                    )}
                                  </div>
                              </li>
                          ) : null;
                      })}
                      </ul>
                    </div>
                  </TabsContent>
                  <TabsContent value="raw" className="min-h-0 flex-1 overflow-hidden px-6 pb-6 pt-4 mt-0 data-[state=inactive]:hidden">
                    <pre className="max-h-[min(60vh,32rem)] overflow-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  </TabsContent>
                </Tabs>
              )}
        </CardContent>
        <CardFooter className="flex flex-row items-center border-t bg-muted/50 px-6 py-3">
          <div className="text-xs text-muted-foreground">
            {data._modified ? (
              <>Last updated <time dateTime={String(data._modified)}>{String(data._modified)}</time></>
            ) : (
              <span className="text-muted-foreground/70">No item selected</span>
            )}
          </div>
        </CardFooter>
      </Card>
    </> 
    )
  }