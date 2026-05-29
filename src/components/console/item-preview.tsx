import {
    Copy,
    GitBranch,
    Lock,
    MoreVertical,
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
import ImagePreview from "@/components/console/image-preview"
import { formatBlueprintFieldValue } from "@/lib/blueprint-field-display"
import {
  getBlueprintIndexPathFieldSet,
  parseBlueprintSourceSpec,
  resolveDocumentTitle,
} from "@/lib/console_utils"


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
}

interface EdgeDefinition {
  edgeType: string;
  outgoingAlias?: string;
  incomingAlias?: string;
}

export default function ItemPreview({selectedId,refreshUp,onDeleteId,blueprint,portfolio,org,ring}: ItemPreviewProps) {


    //const [data, setData] = useState({}); // State to hold table data
    const [data, setData] = useState<DataType>({});

    //const [loading, setLoading] = useState(true); // State to manage loading status
    const [error, setError] = useState<Error | null>(null);
    const [refresh, setRefresh] = useState(false);
    const [showCard, setShowCard] = useState(true);
    const [fieldsDictionary, setFieldsDictionary] = useState<FieldDictionary>({});
    const [graphDialogOpen, setGraphDialogOpen] = useState(false);
    const [graphLoading, setGraphLoading] = useState(false);
    const [graphError, setGraphError] = useState("");
    const [graphResponse, setGraphResponse] = useState<any>(null);
    const [inferredEdgeDefinitions, setInferredEdgeDefinitions] = useState<EdgeDefinition[]>([]);

    const indexPathFields = useMemo(
        () => getBlueprintIndexPathFieldSet(blueprint),
        [blueprint],
    );

    useEffect(() => {
        if (!selectedId) {
            setData({});
            setShowCard(false);
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
              ref[sourceSpec.targetKey] ??
              targetObj?.value ??
              targetObj?.id ??
              targetObj?._id ??
              targetObj?.[sourceSpec.targetKey];
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
      const edgeMap = new Map<string, EdgeDefinition>();
      for (const field of blueprint?.fields || []) {
        if (!field || typeof field !== "object" || field.name === undefined || field.name === null) {
          continue;
        }
        const sourceSpec = parseBlueprintSourceSpec(field.source);
        if (!sourceSpec) {
          continue;
        }
        const fieldName = String(field.name);
        const implicitEdgeType = `${fromBlueprint}:${fieldName}:${sourceSpec.target}:${sourceSpec.targetKey}`;
        const edgeTypes = [implicitEdgeType];
        const sourceLabels =
          field.source && typeof field.source === "object" && !Array.isArray(field.source)
            ? (field.source as Record<string, unknown>).label
            : undefined;
        const sourceAliases = Array.isArray(sourceLabels)
          ? [sourceLabels[0], sourceLabels[1]]
          : [];
        const aliases = Array.isArray(field.edges) && field.edges.length > 0 ? field.edges : sourceAliases;
        for (const edgeType of edgeTypes) {
          const current = edgeMap.get(edgeType) || { edgeType };
          if (!current.outgoingAlias && typeof aliases[0] === "string") {
            current.outgoingAlias = aliases[0];
          }
          if (!current.incomingAlias && typeof aliases[1] === "string") {
            current.incomingAlias = aliases[1];
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
      } finally {
        setGraphLoading(false);
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
        <CardHeader className="flex flex-row items-start gap-3 bg-muted/50">
          <div className="min-w-0 flex-1 grid gap-0.5">
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
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Dialog open={graphDialogOpen} onOpenChange={setGraphDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
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
                <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/20 p-3">
                  <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                    {graphLoading
                      ? "Loading graph edges..."
                      : graphResponse !== null
                        ? JSON.stringify(graphResponse, null, 2)
                        : "No graph query run yet."}
                  </pre>
                </div>
              </DialogContent>
            </Dialog>
            
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
                    <ImagePreview blueprint={blueprint} data={data}/>
                    <div className="mt-6 min-w-0">
                      <div className="font-semibold">Item Details</div>
                      <ul className="mt-3 min-w-0 divide-y divide-border/60">
                      {Object.entries(fieldsDictionary).map(([key, fieldInfo]) => {
                          const value = data[key] ?? data?.attributes?.[key];
                          const isIndexKey = indexPathFields.has(key);
                          return fieldInfo?.widget !== 'image' && !key.startsWith('_') ? (
                              <li
                                  key={key}
                                  className={cn(
                                    "grid min-w-0 grid-cols-1 gap-3 py-3 sm:grid-cols-[minmax(7.5rem,11rem)_minmax(0,1fr)] sm:items-start sm:gap-x-4",
                                    isIndexKey && "rounded-md bg-muted/25 px-2 -mx-2",
                                  )}>
                                  <div className="flex min-w-0 items-center justify-between gap-2 sm:min-h-8 sm:pt-0.5">
                                    <span
                                      className={cn(
                                        "min-w-0 flex-1 text-sm font-medium leading-snug text-muted-foreground",
                                        isIndexKey && "text-muted-foreground/80",
                                      )}
                                    >
                                      {fieldInfo?.label}
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