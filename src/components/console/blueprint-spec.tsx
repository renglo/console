import type { ReactNode } from "react"
import { GitBranch, Hash, List, Lock, Pyramid, Search } from "lucide-react"

import { summarizeBlueprint } from "@/lib/blueprint-spec"
import { cn } from "@/lib/utils"
import type { Blueprint } from "@/lib/console_utils"

type Tone = "search" | "graph" | "vector" | "index" | "fields" | "meta"

const TONE: Record<Tone, string> = {
  search: "border-amber-200/80 bg-amber-50/80 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-50",
  graph: "border-sky-200/80 bg-sky-50/80 text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-50",
  vector: "border-violet-200/80 bg-violet-50/80 text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-50",
  index: "border-slate-200/80 bg-slate-50/90 text-slate-950 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-50",
  fields: "border-emerald-200/80 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-50",
  meta: "border-border bg-muted/40 text-foreground",
}

function Status({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none",
        on
          ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {on ? "On" : "Off"}
    </span>
  )
}

function SpecCell({
  tone,
  icon,
  label,
  on,
  detail,
  title,
}: {
  tone: Tone
  icon: ReactNode
  label: string
  on?: boolean
  detail: string
  title?: string
}) {
  return (
    <div className={cn("rounded-md border px-2.5 py-2", TONE[tone])} title={title}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wide opacity-80">
          {icon}
          {label}
        </span>
        {on !== undefined ? <Status on={on} /> : null}
      </div>
      <div className="mt-1 text-sm font-semibold leading-snug">{detail}</div>
    </div>
  )
}

export default function BlueprintSpec({ blueprint }: { blueprint?: Blueprint }) {
  const spec = summarizeBlueprint(blueprint)
  if (!spec) return null

  const edgeDetail = spec.graphOn
    ? [
        spec.referenceCount ? `${spec.referenceCount} ref` : null,
        spec.literalEdgeCount ? `${spec.literalEdgeCount} literal` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "no edges"

  return (
    <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3">
      <SpecCell
        tone="search"
        icon={<Search className="h-3 w-3 shrink-0" aria-hidden />}
        label="Search"
        on={spec.searchOn}
        detail={spec.searchFieldCount ? `${spec.searchFieldCount} fields` : "not indexed"}
        title="Open a document to see the search icon on each indexed field"
      />
      <SpecCell
        tone="graph"
        icon={<GitBranch className="h-3 w-3 shrink-0" aria-hidden />}
        label="Graph"
        on={spec.graphOn}
        detail={edgeDetail}
        title="Open a document to see the graph icon on reference and literal-edge fields"
      />
      <SpecCell
        tone="vector"
        icon={<Pyramid className="h-3 w-3 shrink-0" aria-hidden />}
        label="Vector"
        on={spec.embedOn}
        detail={
          spec.embedHandler
            ? spec.embedFieldCount
              ? `${spec.embedFieldCount} fields · handler`
              : "handler"
            : spec.embedFieldCount
              ? `${spec.embedFieldCount} fields`
              : "not embedded"
        }
        title="Open a document to see the pyramid icon on embedded fields"
      />
      <SpecCell
        tone="index"
        icon={<Lock className="h-3 w-3 shrink-0" aria-hidden />}
        label="Index"
        on={spec.indexOn}
        detail={spec.indexOn ? `${spec.indexParts}-part key` : "no path"}
        title="Open a document to see the lock icon on indexes.path fields"
      />
      <SpecCell
        tone="fields"
        icon={<List className="h-3 w-3 shrink-0" aria-hidden />}
        label="Fields"
        detail={`${spec.fieldCount} (${spec.requiredCount} req)`}
      />
      <SpecCell
        tone="meta"
        icon={<Hash className="h-3 w-3 shrink-0" aria-hidden />}
        label="Meta"
        detail={spec.version ? `v${spec.version}` : "—"}
      />
    </div>
  )
}
