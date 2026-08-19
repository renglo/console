import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  createDomainColorScale,
  type DomainColorDictionary,
} from "./domain-colors";

const LEGEND_HIDDEN_SWATCH_COLOR = "#94a3b8";

/** Opaque layer id — domain meaning is supplied by the caller via layerStyles. */
export type ForceGraphLayerId = string;

export type ForceGraphSymbolName = "circle" | "square" | "triangle";

export interface ForceGraphLayerStyle {
  id: ForceGraphLayerId;
  label: string;
  symbol?: ForceGraphSymbolName;
}

export interface ForceGraphLinkLike {
  source: string;
  target: string;
  label: string;
  dangling?: boolean;
  derived?: boolean;
  crossLayer?: boolean;
}

export interface ForceGraphNodeLike {
  id: string;
  label?: string;
  group: string;
  linkCount: number;
  isDangling?: boolean;
  universalType?: string;
  universalDomain?: string;
  provider?: string;
  providerType?: string;
  externalId?: string;
  name?: string;
  /** Optional caller-defined layer id; shape comes from layerStyles. */
  layer?: ForceGraphLayerId;
}

export interface ForceGraphDataLike {
  nodes: ForceGraphNodeLike[];
  links: ForceGraphLinkLike[];
}

type SimNode = ForceGraphNodeLike & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  clusterX?: number;
  clusterY?: number;
  pinnedByUser?: boolean;
};

type SimLink = d3.SimulationLinkDatum<SimNode> & {
  label: string;
  dangling?: boolean;
  derived?: boolean;
  crossLayer?: boolean;
};

export const FORCE_GRAPH_DERIVED_EDGE_COLOR = "#00BFFF";
export const FORCE_GRAPH_CROSS_LAYER_EDGE_COLOR = "#94a3b8";
const FORCE_GRAPH_DISCOVERED_EDGE_COLOR = "#64748b";
const FORCE_GRAPH_DANGLING_EDGE_COLOR = "#94a3b8";

const SYMBOL_BY_NAME: Record<ForceGraphSymbolName, d3.SymbolType> = {
  circle: d3.symbolCircle,
  square: d3.symbolSquare,
  triangle: d3.symbolTriangle,
};

function symbolForLayer(
  layer: ForceGraphLayerId | undefined,
  layerStyles: ReadonlyArray<ForceGraphLayerStyle> | undefined,
): d3.SymbolType {
  if (layer && layerStyles?.length) {
    const match = layerStyles.find((style) => style.id === layer);
    if (match?.symbol) {
      return SYMBOL_BY_NAME[match.symbol] ?? d3.symbolCircle;
    }
  }
  return d3.symbolCircle;
}

function isDerivedGraphLink(link: SimLink): boolean {
  return link.derived === true;
}

function isCrossLayerGraphLink(link: SimLink): boolean {
  return link.crossLayer === true;
}

function styleGraphLinkSelection(
  selection: d3.Selection<d3.BaseType | SVGLineElement, SimLink, SVGGElement, unknown>,
) {
  selection
    .attr("stroke-width", (link) => {
      if (isDerivedGraphLink(link)) return 2.5;
      if (isCrossLayerGraphLink(link)) return 2;
      return link.dangling ? 1 : 1.4;
    })
    .attr("stroke-dasharray", (link) => {
      if (isDerivedGraphLink(link)) return null;
      if (isCrossLayerGraphLink(link)) return "2 10 2 10";
      if (link.dangling) return "4 3";
      return null;
    })
    .attr("stroke", (link) => {
      if (isDerivedGraphLink(link)) {
        return FORCE_GRAPH_DERIVED_EDGE_COLOR;
      }
      if (isCrossLayerGraphLink(link)) {
        return FORCE_GRAPH_CROSS_LAYER_EDGE_COLOR;
      }
      return link.dangling ? FORCE_GRAPH_DANGLING_EDGE_COLOR : FORCE_GRAPH_DISCOVERED_EDGE_COLOR;
    })
    .attr("stroke-opacity", (link) => {
      if (isDerivedGraphLink(link)) return 1;
      if (isCrossLayerGraphLink(link)) return 0.85;
      return 0.55;
    })
    .attr("pointer-events", "none");
}

function nodeSymbolSize(node: SimNode): number {
  const radius = node.isDangling ? 4 : 5 + Math.min(node.linkCount, 6);
  return Math.PI * radius * radius;
}

interface ForceGraphDiagramProps {
  graphData: ForceGraphDataLike;
  selectedNodeId: string | null;
  onSelectNode: (node: ForceGraphNodeLike | null) => void;
  domainColors?: DomainColorDictionary;
  className?: string;
  /** Optional shape mapping for node.layer values. Default: all circles. */
  layerStyles?: ReadonlyArray<ForceGraphLayerStyle>;
}

export default function ForceGraphDiagram({
  graphData,
  selectedNodeId,
  onSelectNode,
  domainColors,
  className,
  layerStyles,
}: ForceGraphDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const onSelectNodeRef = useRef(onSelectNode);
  const layerStylesRef = useRef(layerStyles);
  const [dimensions, setDimensions] = useState({ width: 960, height: 640 });

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    layerStylesRef.current = layerStyles;
  }, [layerStyles]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      setDimensions({
        width: Math.max(320, Math.floor(width)),
        height: Math.max(240, Math.floor(height)),
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const colorByDomain = useMemo(() => {
    const domains = [...new Set(graphData.nodes.map((node) => node.group))].sort();
    return createDomainColorScale(domains, domainColors);
  }, [graphData.nodes, domainColors]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement || graphData.nodes.length === 0) {
      return;
    }

    const { width, height } = dimensions;
    const nodes: SimNode[] = graphData.nodes.map((node) => ({ ...node }));
    const links: SimLink[] = graphData.links.map((link) => ({ ...link }));
    const styles = layerStylesRef.current;

    const groups = [...new Set(nodes.map((node) => node.group))].sort();
    const groupIndex = new Map(groups.map((group, index) => [group, index]));
    const clusterRadius = Math.min(width, height) * 0.32;

    for (const node of nodes) {
      const index = groupIndex.get(node.group) ?? 0;
      const angle = (2 * Math.PI * index) / Math.max(groups.length, 1);
      node.clusterX = width / 2 + clusterRadius * Math.cos(angle);
      node.clusterY = height / 2 + clusterRadius * Math.sin(angle);
    }

    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();

    const root = svg.append("g");
    const zoomLayer = root.append("g");

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on("zoom", (event) => {
          zoomLayer.attr("transform", event.transform.toString());
        }),
    );

    const baseLinks = links.filter(
      (link) => !isDerivedGraphLink(link) && !isCrossLayerGraphLink(link),
    );
    const crossLayerLinks = links.filter(
      (link) => isCrossLayerGraphLink(link) && !isDerivedGraphLink(link),
    );
    const derivedLinks = links.filter((link) => isDerivedGraphLink(link));

    const baseLinkSelection = zoomLayer
      .append("g")
      .attr("class", "graph-links-base")
      .selectAll("line")
      .data(baseLinks)
      .join("line");
    styleGraphLinkSelection(baseLinkSelection);

    const crossLayerLinkSelection = zoomLayer
      .append("g")
      .attr("class", "graph-links-cross-layer")
      .selectAll("line")
      .data(crossLayerLinks)
      .join("line");
    styleGraphLinkSelection(crossLayerLinkSelection);

    const derivedLinkSelection = zoomLayer
      .append("g")
      .attr("class", "graph-links-derived")
      .selectAll("line")
      .data(derivedLinks)
      .join("line");
    styleGraphLinkSelection(derivedLinkSelection);

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .distance(54)
          .strength(0.35),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-110))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide<SimNode>().radius((node) => (node.isDangling ? 8 : 10)),
      )
      .force(
        "clusterX",
        d3.forceX<SimNode>((node) => node.clusterX ?? width / 2).strength(0.07),
      )
      .force(
        "clusterY",
        d3.forceY<SimNode>((node) => node.clusterY ?? height / 2).strength(0.07),
      );

    const nodeSelection = zoomLayer
      .append("g")
      .attr("class", "graph-nodes")
      .selectAll<SVGPathElement, SimNode>("path")
      .data(nodes)
      .join("path")
      .attr("d", (node) =>
        d3
          .symbol()
          .type(symbolForLayer(node.layer, styles))
          .size(nodeSymbolSize(node))(),
      )
      .attr("fill", (node) => colorByDomain(node.group))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.2)
      .attr("opacity", (node) => (node.isDangling ? 0.65 : 0.95))
      .style("cursor", "pointer");

    nodeSelection.call(
      d3
        .drag<SVGPathElement, SimNode>()
        .clickDistance(4)
        .on("start", (event, node) => {
          if (!event.active) {
            simulation.alphaTarget(0.25).restart();
          }
          node.fx = node.fx ?? node.x;
          node.fy = node.fy ?? node.y;
        })
        .on("drag", (event, node) => {
          node.fx = event.x;
          node.fy = event.y;
        })
        .on("end", (event, node) => {
          if (!event.active) {
            simulation.alphaTarget(0);
          }
          node.fx = event.x;
          node.fy = event.y;
          node.pinnedByUser = true;
        }),
    );
    nodeSelection
      .on("click", (event, node) => {
        event.stopPropagation();
        onSelectNodeRef.current(node);
      })
      .on("dblclick", (event, node) => {
        event.stopPropagation();
        node.fx = null;
        node.fy = null;
        node.pinnedByUser = false;
        simulation.alphaTarget(0.12).restart();
      });

    svg.on("click", () => {
      onSelectNodeRef.current(null);
    });

    const updateLinkPositions = (
      selection: d3.Selection<d3.BaseType | SVGLineElement, SimLink, SVGGElement, unknown>,
    ) => {
      selection
        .attr("x1", (link) => (link.source as SimNode).x ?? 0)
        .attr("y1", (link) => (link.source as SimNode).y ?? 0)
        .attr("x2", (link) => (link.target as SimNode).x ?? 0)
        .attr("y2", (link) => (link.target as SimNode).y ?? 0);
    };

    simulation.on("tick", () => {
      updateLinkPositions(baseLinkSelection);
      updateLinkPositions(crossLayerLinkSelection);
      updateLinkPositions(derivedLinkSelection);

      nodeSelection.attr(
        "transform",
        (node) => `translate(${node.x ?? 0},${node.y ?? 0})`,
      );
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, dimensions, colorByDomain, layerStyles]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }
    d3.select(svgElement)
      .selectAll<SVGPathElement, SimNode>("g.graph-nodes path")
      .attr("stroke", (node) => (node.id === selectedNodeId ? "#0f172a" : "#ffffff"))
      .attr("stroke-width", (node) => (node.id === selectedNodeId ? 2.5 : 1.2));
  }, [selectedNodeId]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full min-h-0 w-full", className)}
    >
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="block" />
    </div>
  );
}

export function ForceGraphLayerShapeLegend({
  layerStyles,
  className,
}: {
  layerStyles: ReadonlyArray<ForceGraphLayerStyle>;
  className?: string;
}) {
  if (!layerStyles.length) {
    return null;
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {layerStyles.map((item) => (
        <div
          key={item.id}
          className="inline-flex items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1 text-xs"
        >
          <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">
            <path
              d={
                d3
                  .symbol()
                  .type(symbolForLayer(item.id, layerStyles))
                  .size(48)() ?? undefined
              }
              fill="#64748b"
              stroke="#ffffff"
              strokeWidth="1"
            />
          </svg>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function LegendColorSwatch({
  color,
  layer,
  layerStyles,
}: {
  color: string;
  layer?: ForceGraphLayerId;
  layerStyles?: ReadonlyArray<ForceGraphLayerStyle>;
}) {
  const symbol = symbolForLayer(layer, layerStyles);
  return (
    <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true" className="shrink-0">
      <path
        d={d3.symbol().type(symbol).size(52)() ?? undefined}
        fill={color}
        stroke="#ffffff"
        strokeWidth="1"
      />
    </svg>
  );
}

export function ForceGraphLegend({
  domains,
  hiddenDomains,
  onToggleDomain,
  domainColors,
  layer,
  domainLayers,
  layerStyles,
}: {
  domains: string[];
  hiddenDomains?: ReadonlySet<string>;
  onToggleDomain?: (domain: string) => void;
  domainColors?: DomainColorDictionary;
  /** Default layer id for color swatches when domainLayers has no entry. */
  layer?: ForceGraphLayerId;
  /** Per-domain layer override (e.g. when cross-layer nodes are mixed in). */
  domainLayers?: ReadonlyMap<string, ForceGraphLayerId> | Record<string, ForceGraphLayerId>;
  /** Optional layer labels/shapes for grouped legends. Without this, domains render flat. */
  layerStyles?: ReadonlyArray<ForceGraphLayerStyle>;
}) {
  const colorByDomain = useMemo(() => {
    return createDomainColorScale(domains, domainColors);
  }, [domains, domainColors]);

  const layerForDomain = useMemo(() => {
    return (domain: string): ForceGraphLayerId | undefined => {
      if (domainLayers instanceof Map) {
        return domainLayers.get(domain) ?? layer;
      }
      if (domainLayers && typeof domainLayers === "object") {
        return (domainLayers as Record<string, ForceGraphLayerId>)[domain] ?? layer;
      }
      return layer;
    };
  }, [domainLayers, layer]);

  const groupedDomains = useMemo(() => {
    if (!layerStyles?.length) {
      return [
        {
          layer: layer,
          label: undefined as string | undefined,
          domains: [...domains].sort((a, b) => a.localeCompare(b)),
        },
      ];
    }

    const groups = new Map<string, string[]>();
    for (const style of layerStyles) {
      groups.set(style.id, []);
    }
    const unknown: string[] = [];
    for (const domain of domains) {
      const domainLayer = layerForDomain(domain);
      if (domainLayer && groups.has(domainLayer)) {
        groups.get(domainLayer)!.push(domain);
      } else {
        unknown.push(domain);
      }
    }
    const ordered = layerStyles.map((style) => ({
      layer: style.id,
      label: style.label,
      domains: (groups.get(style.id) || []).sort((a, b) => a.localeCompare(b)),
    }));
    if (unknown.length) {
      ordered.push({
        layer: "__other__",
        label: "Other",
        domains: unknown.sort((a, b) => a.localeCompare(b)),
      });
    }
    return ordered.filter((group) => group.domains.length > 0);
  }, [domains, layer, layerForDomain, layerStyles]);

  if (domains.length === 0) {
    return null;
  }

  const hidden = hiddenDomains ?? new Set<string>();
  const toggleable = typeof onToggleDomain === "function";
  const showGroupLabels = groupedDomains.length > 1;

  return (
    <div className="flex flex-col gap-2">
      {groupedDomains.map((group) => (
        <div key={group.layer ?? "default"} className="flex flex-wrap items-center gap-2">
          {showGroupLabels && group.label ? (
            <span className="mr-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </span>
          ) : null}
          {group.domains.map((domain) => {
            const isHidden = hidden.has(domain);
            const label = domain.replace(/_/g, " ");
            const content = (
              <>
                <LegendColorSwatch
                  layer={group.layer}
                  layerStyles={layerStyles}
                  color={
                    isHidden ? LEGEND_HIDDEN_SWATCH_COLOR : colorByDomain(domain)
                  }
                />
                <span className="capitalize">{label}</span>
              </>
            );

            if (!toggleable) {
              return (
                <div
                  key={domain}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1 text-xs"
                >
                  {content}
                </div>
              );
            }

            return (
              <button
                key={domain}
                type="button"
                aria-pressed={!isHidden}
                onClick={() => onToggleDomain(domain)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                  isHidden
                    ? "border-muted bg-muted/30 text-muted-foreground hover:bg-muted/40"
                    : "border bg-muted/20 hover:bg-muted/30",
                )}
              >
                {content}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
