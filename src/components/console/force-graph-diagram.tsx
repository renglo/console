import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  createDomainColorScale,
  type DomainColorDictionary,
} from "./domain-colors";

const LEGEND_HIDDEN_SWATCH_COLOR = "#94a3b8";

export interface ForceGraphLinkLike {
  source: string;
  target: string;
  label: string;
  dangling?: boolean;
  derived?: boolean;
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
};

export const FORCE_GRAPH_DERIVED_EDGE_COLOR = "#00BFFF";
const FORCE_GRAPH_DISCOVERED_EDGE_COLOR = "#64748b";
const FORCE_GRAPH_DANGLING_EDGE_COLOR = "#94a3b8";

function isDerivedGraphLink(link: SimLink): boolean {
  return link.derived === true;
}

function styleGraphLinkSelection(
  selection: d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown>,
) {
  selection
    .attr("stroke-width", (link) =>
      isDerivedGraphLink(link) ? 2.5 : link.dangling ? 1 : 1.4,
    )
    .attr("stroke-dasharray", (link) =>
      link.dangling && !isDerivedGraphLink(link) ? "4 3" : null,
    )
    .attr("stroke", (link) => {
      if (isDerivedGraphLink(link)) {
        return "#00BFFF";
      }
      return link.dangling ? FORCE_GRAPH_DANGLING_EDGE_COLOR : FORCE_GRAPH_DISCOVERED_EDGE_COLOR;
    })
    .attr("stroke-opacity", (link) => (isDerivedGraphLink(link) ? 1 : 0.55))
    .attr("pointer-events", "none");
}

interface ForceGraphDiagramProps {
  graphData: ForceGraphDataLike;
  selectedNodeId: string | null;
  onSelectNode: (node: ForceGraphNodeLike | null) => void;
  domainColors?: DomainColorDictionary;
  className?: string;
}

export default function ForceGraphDiagram({
  graphData,
  selectedNodeId,
  onSelectNode,
  domainColors,
  className,
}: ForceGraphDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const onSelectNodeRef = useRef(onSelectNode);
  const [dimensions, setDimensions] = useState({ width: 960, height: 640 });

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

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

    const baseLinks = links.filter((link) => !isDerivedGraphLink(link));
    const derivedLinks = links.filter((link) => isDerivedGraphLink(link));

    const baseLinkSelection = zoomLayer
      .append("g")
      .attr("class", "graph-links-base")
      .selectAll("line")
      .data(baseLinks)
      .join("line");
    styleGraphLinkSelection(baseLinkSelection);

    const derivedLinkSelection = zoomLayer
      .append("g")
      .attr("class", "graph-links-derived")
      .selectAll("line")
      .data(derivedLinks)
      .join("line");
    styleGraphLinkSelection(derivedLinkSelection);

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .distance((link) => (link.dangling ? 72 : 52))
          .strength(0.55),
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
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (node) => (node.isDangling ? 4 : 5 + Math.min(node.linkCount, 6)))
      .attr("fill", (node) => colorByDomain(node.group))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.2)
      .attr("opacity", (node) => (node.isDangling ? 0.65 : 0.95))
      .style("cursor", "pointer");
    (
      nodeSelection as unknown as d3.Selection<
        SVGCircleElement,
        SimNode,
        SVGGElement,
        unknown
      >
    ).call(
      d3
        .drag<SVGCircleElement, SimNode>()
        .clickDistance(4)
        .on("start", (event, node) => {
          if (!event.active) {
            simulation.alphaTarget(0.25).restart();
          }
          // Keep existing pinned position if user already pinned this node.
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
          // Preserve user-arranged position for easier manual layout.
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
        // Double-click to release a user-pinned node back to simulation forces.
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
      selection: d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown>,
    ) => {
      selection
        .attr("x1", (link) => (link.source as SimNode).x ?? 0)
        .attr("y1", (link) => (link.source as SimNode).y ?? 0)
        .attr("x2", (link) => (link.target as SimNode).x ?? 0)
        .attr("y2", (link) => (link.target as SimNode).y ?? 0);
    };

    simulation.on("tick", () => {
      updateLinkPositions(baseLinkSelection);
      updateLinkPositions(derivedLinkSelection);

      nodeSelection
        .attr("cx", (node) => node.x ?? 0)
        .attr("cy", (node) => node.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, dimensions, colorByDomain]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }
    d3.select(svgElement)
      .selectAll<SVGCircleElement, SimNode>("circle")
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

export function ForceGraphLegend({
  domains,
  hiddenDomains,
  onToggleDomain,
  domainColors,
}: {
  domains: string[];
  hiddenDomains?: ReadonlySet<string>;
  onToggleDomain?: (domain: string) => void;
  domainColors?: DomainColorDictionary;
}) {
  const colorByDomain = useMemo(() => {
    return createDomainColorScale(domains, domainColors);
  }, [domains, domainColors]);

  if (domains.length === 0) {
    return null;
  }

  const hidden = hiddenDomains ?? new Set<string>();
  const toggleable = typeof onToggleDomain === "function";

  return (
    <div className="flex flex-wrap gap-2">
      {domains.map((domain) => {
        const isHidden = hidden.has(domain);
        const label = domain.replace(/_/g, " ");
        const content = (
          <>
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: isHidden
                  ? LEGEND_HIDDEN_SWATCH_COLOR
                  : colorByDomain(domain),
              }}
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
  );
}
