"use client"

import * as React from "react"
import { useState, useEffect } from 'react';

import { replaceUUID, isBlueprintTableField, enrichBlueprintRichFromRows } from '@/lib/console_utils';


import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { 
  MoreHorizontal,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"


function generateReactType(fields:any) {

  console.log('Field to be filtered (GRT)')
  console.log(fields)

  const filteredFields = fields.filter((field: any) => isBlueprintTableField(field));
  //const filteredFields = fields;
  console.log('Filtered Fields (GRT)')
  console.log(filteredFields)
  // Create an object to store the type definition
  const typeDefinition: {[index: string]:any} = {};
  //const myObj: {[index: string]:any} = {}

  filteredFields.forEach((field:any) => {
    const name: string = field.name;
  
    if (field.options) {
      // Create union type for fields with options, considering the keys of the options object
      typeDefinition[name] = Object.keys(field.options).map(option => `"${option}"`).join(" | ");
    } else {
      typeDefinition[name] = field.type;
    }
  });

  console.log('Type Definition (GRT)')
  console.log(typeDefinition)

  return typeDefinition;
}

  
interface RowData {
  _id?: string;
  // Add more properties if necessary
}

interface ColumnType {
  getIsSorted: () => string | false;
  toggleSorting: (desc: boolean) => void;
}

interface RowType {
  getValue: (key: string) => unknown;
}

interface WidgetDefinition {
  h: ({ column }: { column: ColumnType }) => JSX.Element;
  c: ({ row }: { row: RowType }) => JSX.Element;
}

function TableWidgetDef(widget: string, label: string, name: string): ColumnDef<RowType, unknown> {
  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map((entry) => String(entry ?? "")).join(", ");
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  if (widget === "currency_usd") {
    const w: WidgetDefinition = {
      h: () => <div className="text-center">{label}</div>,
      c: ({ row }) => {
        const raw = row.getValue(name);
        const amount = Number(raw);
        if (!Number.isFinite(amount)) {
          return <div className="text-center font-medium">{formatCellValue(raw)}</div>;
        }
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount);
        return <div className="text-center font-medium">{formatted}</div>;
      },
    };

    return {
      accessorKey: name,
      header: w.h,
      cell: w.c,
    };
  }

  const sortableWidgets = new Set([
    "text",
    "select",
    "date",
    "time",
    "datetime",
    "timerange",
    "daterange",
  ]);
  const isSortable = sortableWidgets.has(widget);

  const w: WidgetDefinition = {
    h: ({ column }) =>
      isSortable ? (
        <Button
          variant="ghost"
          className="text-left"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {label}
        </Button>
      ) : (
        <div className="text-left">{label}</div>
      ),
    c: ({ row }) => (
      <div className="capitalize">{formatCellValue(row.getValue(name))}</div>
    ),
  };

  return {
    accessorKey: name,
    header: w.h,
    cell: w.c,
  };
}


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
  layer?: number | string;
  level?: number | string;
  multilingual: boolean;
  order: number;
  required: boolean;
  semantic: string;
  source: string;
}



function generateColumnDef(fields: Field[]): any[] {
  const output: any[] = [];

  console.log('Field to be filtered (GCD)')
  console.log(fields)

  const filteredFields = fields.filter((field) => isBlueprintTableField(field));
  //const filteredFields = fields;

  console.log('Filtered Fields (GCD)')
  console.log(filteredFields)



  for (const field of filteredFields) {
    const row = TableWidgetDef(field.widget, field.label, field.name);
    output.push(row);
  }

  console.log('Output (GCD)')
  console.log(output)

  return output;
}


const tableFooter = {
  id: "actions",
  enableHiding: false,
  cell: ({ row }: { row: { original: RowData } }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => navigator.clipboard.writeText(String(row.original._id ?? ""))}
          >
            Copy Item ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>View Details</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};


interface DataTableProps {
  onSelectId: (id: string) => void;
  selectedId?: string;
  refresh: any;
  blueprint: any;
  portfolio: string;
  org: string;
  tool: string;
  ring: string;
}


// Define the type for your data items
interface DataItem {
  _id?: string;
  [key: string]: any; // Adjust this to the specific structure of your data
}

export default function DataTable({
  onSelectId,
  selectedId,
  refresh,
  blueprint,
  portfolio,
  org,
  tool,
  ring,
}: DataTableProps) {

  let columnDefs = []; 

  console.log('BLUEPRINT 111')
  console.log(blueprint);
  console.log(tool);

  // Add Definitions to ColumnDef
  // Assuming generateReactType generates an object type from fields
  //DEPRECATED//const FieldsType = generateReactType(fields);
  // Now use typeof to extract the type
  type FieldsType = ReturnType<typeof generateReactType>;

  //const [blueprint, setBlueprint] = useState({});
  const [data, setData] = useState<DataItem[]>([]);

  const [columns, setColumns] = useState<ColumnDef<FieldsType>[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [cachedPages, setCachedPages] = useState<DataItem[][]>([]);
  const [nextCursors, setNextCursors] = useState<(string | null)[]>([]);

  const [idDraft, setIdDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [appliedId, setAppliedId] = useState("");
  const [appliedContent, setAppliedContent] = useState("");

  const applySearch = () => {
    setAppliedId(idDraft.trim());
    setAppliedContent(contentDraft.trim());
    setCachedPages([]);
    setNextCursors([]);
    setPageIndex(0);
  };

  const clearSearch = () => {
    setIdDraft("");
    setContentDraft("");
    setAppliedId("");
    setAppliedContent("");
    setCachedPages([]);
    setNextCursors([]);
    setPageIndex(0);
  };

  const portfolio_id = portfolio;
  const org_id = org;
  const ring_id = ring;
  const listBase = `${import.meta.env.VITE_API_URL}/_data/${portfolio_id}/${org_id}/${ring_id}`;

  const enrichAndReplaceRows = async (rawItems: DataItem[]): Promise<DataItem[]> => {
    await enrichBlueprintRichFromRows(rawItems, blueprint, portfolio_id, org_id);
    return replaceUUID(rawItems, blueprint);
  };

  useEffect(() => {
    if (!blueprint?.fields?.length) return;
    try {
      columnDefs = generateColumnDef(blueprint.fields);
      columnDefs.push(tableFooter);
      setColumns(columnDefs as ColumnDef<FieldsType>[]);
    } catch (err) {
      if (err instanceof Error) setError(err);
    }
  }, [blueprint]);

  useEffect(() => {
    if (!blueprint?.fields?.length) return;

    const runContentOrIdSearch = async () => {
      setLoading(true);
      try {
        if (appliedContent.trim()) {
          const dataResponse = await fetch(listBase, {
            method: "GET",
            headers: { Authorization: `Bearer ${sessionStorage.accessToken}` },
          });
          const response = await dataResponse.json();
          const rawItems = response["items"] ?? [];
          let rows = await enrichAndReplaceRows(rawItems);
          const needle = appliedContent.trim().toLowerCase();
          rows = rows.filter((row: DataItem) =>
            JSON.stringify(row).toLowerCase().includes(needle)
          );
          const idNeedle = appliedId.trim().toLowerCase();
          if (idNeedle) {
            rows = rows.filter((row: DataItem) =>
              String(row._id ?? "").toLowerCase().includes(idNeedle)
            );
          }
          setData(rows);
          return;
        }

        if (appliedId.trim()) {
          const q = appliedId.trim();
          const one = await fetch(`${listBase}/${encodeURIComponent(q)}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${sessionStorage.accessToken}` },
          });
          if (one.ok) {
            const doc = await one.json();
            const arr = Array.isArray(doc) ? doc : [doc];
            setData(await enrichAndReplaceRows(arr));
            return;
          }

          const qRes = await fetch(`${listBase}/_query?limit=200&sort=desc`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sessionStorage.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              operator: "begins_with",
              value: q,
              sort: "desc",
            }),
          });
          const qJson = await qRes.json();
          const qItems = qJson["items"] ?? [];
          setData(await enrichAndReplaceRows(qItems));
          return;
        }
      } catch (err) {
        if (err instanceof Error) setError(err);
        else setError(new Error("An unknown error occurred"));
      } finally {
        setLoading(false);
      }
    };

    if (appliedId.trim() || appliedContent.trim()) {
      void runContentOrIdSearch();
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          paged: "1",
          limit: String(pageSize),
        });
        const dataResponse = await fetch(`${listBase}?${params}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${sessionStorage.accessToken}` },
        });
        const response = await dataResponse.json();
        const rawItems = response["items"] ?? [];
        const rows = await enrichAndReplaceRows(rawItems);
        if (cancelled) return;
        setCachedPages([rows]);
        setNextCursors([response["last_id"] ?? null]);
        setPageIndex(0);
        setData(rows);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof Error) setError(err);
          else setError(new Error("An unknown error occurred"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    blueprint,
    org,
    refresh,
    pageSize,
    ring_id,
    portfolio_id,
    appliedId,
    appliedContent,
  ]);

  useEffect(() => {
    if (appliedId.trim() || appliedContent.trim()) return;
    if (!cachedPages.length) return;
    const rows = cachedPages[pageIndex];
    if (rows) setData(rows);
  }, [pageIndex, cachedPages, appliedId, appliedContent]);

  const goNextPage = async () => {
    if (appliedId.trim() || appliedContent.trim()) return;
    if (pageIndex < cachedPages.length - 1) {
      setPageIndex((i) => i + 1);
      return;
    }
    const cursor = nextCursors[pageIndex];
    if (!cursor) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        paged: "1",
        limit: String(pageSize),
        lastkey: cursor,
      });
      const dataResponse = await fetch(`${listBase}?${params}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${sessionStorage.accessToken}` },
      });
      const response = await dataResponse.json();
      const rawItems = response["items"] ?? [];
      const rows = await enrichAndReplaceRows(rawItems);
      setCachedPages((p) => [...p, rows]);
      setNextCursors((c) => [...c, response["last_id"] ?? null]);
      setPageIndex((i) => i + 1);
      setData(rows);
    } catch (err) {
      if (err instanceof Error) setError(err);
    } finally {
      setLoading(false);
    }
  };

  const goPrevPage = () => {
    if (pageIndex > 0) setPageIndex((i) => i - 1);
  };

  const browseMode = !appliedId.trim() && !appliedContent.trim();
  const searchDirty =
    idDraft.trim() !== appliedId || contentDraft.trim() !== appliedContent;
  const canGoNext =
    browseMode &&
    (pageIndex < cachedPages.length - 1 ||
      Boolean(nextCursors[pageIndex]));

  //console.log(blueprint)
  //console.log(data)


  /*
  // 3. Generate the Column Definitions
  // Generate Column Defs
  columnDefs = generateColumnDef(fields);
  // Add header to the beginning
  columnDefs.unshift(tableHeader); 
  // Add footedto the end
  columnDefs.push(tableFooter);
  // Add Definitions to ColumnDef
  let Type = generateReactType(fields);
  // 4. Create Columns
  const columns: ColumnDef<Type>[] = columnDefs
  */



  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});


  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    //getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })
  



  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col gap-3">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          applySearch();
        }}
      >
        <div className="grid w-full gap-1.5 sm:max-w-xs">
          <Label htmlFor="data-id-search">ID or prefix</Label>
          <Input
            id="data-id-search"
            placeholder="Exact id or prefix (index search)…"
            value={idDraft}
            onChange={(e) => setIdDraft(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="grid w-full flex-1 gap-1.5 sm:min-w-[12rem]">
          <Label htmlFor="data-content-search">Text in document</Label>
          <Input
            id="data-content-search"
            placeholder="Substring in JSON (loads full list)…"
            value={contentDraft}
            onChange={(e) => setContentDraft(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" size="sm" disabled={loading}>
            Search
          </Button>
          {(appliedId ||
            appliedContent ||
            idDraft ||
            contentDraft) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={clearSearch}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <Label htmlFor="data-page-size" className="whitespace-nowrap text-muted-foreground">
            Rows / page
          </Label>
          <select
            id="data-page-size"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm"
            value={pageSize}
            disabled={!browseMode}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPageIndex(0);
              setCachedPages([]);
              setNextCursors([]);
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </form>
      {searchDirty && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Click Search to run the query.
        </p>
      )}
      {loading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error.message}</p>
      )}

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-md border">
        <Table className="w-max min-w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={
                    selectedId && row.original._id === selectedId
                      ? "bg-muted/80"
                      : "cursor-pointer"
                  }
                  onClick={() => {
                    if (row.original._id) onSelectId(row.original._id);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={Math.max(columns.length, 1)}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <p className="text-sm text-muted-foreground">
          {browseMode ? (
            <>
              Page {pageIndex + 1} · {data.length} row(s) on this page
              {!nextCursors[pageIndex] && data.length > 0
                ? " · no further pages"
                : ""}
            </>
          ) : (
            <>
              {data.length} match(es)
              {appliedContent.trim()
                ? " · full list scan"
                : appliedId.trim()
                  ? " · id search"
                  : ""}
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrevPage}
            disabled={!browseMode || pageIndex === 0 || loading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void goNextPage()}
            disabled={!browseMode || !canGoNext || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}


