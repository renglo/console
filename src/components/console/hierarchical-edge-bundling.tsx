import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  createDomainColorScale,
  type DomainColorDictionary,
} from "./domain-colors";

export interface EdgeBundlingLeafLike {
  id: string;
  path: string;
  label: string;
  provider: string;
  providerType: string;
  universalType: string;
  universalDomain: string;
}

export interface EdgeBundlingLinkLike {
  sourcePath: string;
  targetPath: string;
  label: string;
  relationshipClass: string;
  derived: boolean;
  dangling: boolean;
}

export interface EdgeBundlingDataLike {
  leaves: EdgeBundlingLeafLike[];
  links: EdgeBundlingLinkLike[];
}

interface HierarchicalEdgeBundlingProps {
  data: EdgeBundlingDataLike;
  domainColors?: DomainColorDictionary;
  className?: string;
}

type HierNode = d3.HierarchyPointNode<{ path: string }>;

function hierarchyPath(node: HierNode): string {
  return node.data.path;
}

export default function HierarchicalEdgeBundling({
  data,
  domainColors,
  className,
}: HierarchicalEdgeBundlingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 960, height: 960 });

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
      const size = Math.max(360, Math.floor(Math.min(entry.contentRect.width, entry.contentRect.height)));
      setDimensions({ width: size, height: size });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const colorByDomain = useMemo(() => {
    const domains = [...new Set(data.leaves.map((leaf) => leaf.universalDomain))].sort();
    return createDomainColorScale(domains, domainColors);
  }, [data.leaves, domainColors]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }
    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();

    if (data.leaves.length === 0 || data.links.length === 0) {
      return;
    }

    const leafByPath = new Map(data.leaves.map((leaf) => [leaf.path, leaf]));
    const allPaths = new Set<string>();
    allPaths.add("root");

    for (const leaf of data.leaves) {
      const segments = leaf.path.split("/");
      for (let i = 1; i <= segments.length; i += 1) {
        allPaths.add(segments.slice(0, i).join("/"));
      }
    }
    for (const link of data.links) {
      for (const path of [link.sourcePath, link.targetPath]) {
        const segments = path.split("/");
        for (let i = 1; i <= segments.length; i += 1) {
          allPaths.add(segments.slice(0, i).join("/"));
        }
      }
    }

    const stratify = d3
      .stratify<{ path: string }>()
      .id((d) => d.path)
      .parentId((d) => {
        if (d.path === "root") {
          return null;
        }
        const idx = d.path.lastIndexOf("/");
        return idx > 0 ? d.path.slice(0, idx) : "root";
      });

    const root = stratify(Array.from(allPaths.values()).map((path) => ({ path })));
    const { width, height } = dimensions;
    const radius = Math.min(width, height) / 2 - 56;
    const cluster = d3.cluster<{ path: string }>().size([2 * Math.PI, radius]);
    cluster(root);

    const hierarchyByPath = new Map<string, HierNode>();
    for (const node of root.descendants()) {
      hierarchyByPath.set(hierarchyPath(node as HierNode), node as HierNode);
    }
    const leafNodes = root
      .leaves()
      .filter((node) => leafByPath.has(hierarchyPath(node as HierNode))) as HierNode[];

    const line = d3
      .lineRadial<HierNode>()
      .curve(d3.curveBundle.beta(0.88))
      .radius((node) => node.y)
      .angle((node) => node.x);

    const bundledPaths = data.links
      .map((link) => {
        const source = hierarchyByPath.get(link.sourcePath);
        const target = hierarchyByPath.get(link.targetPath);
        if (!source || !target) {
          return null;
        }
        const sourceLeaf = leafByPath.get(link.sourcePath);
        return {
          link,
          source,
          target,
          sourceLeaf,
          points: source.path(target),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    svg.attr("viewBox", `0 0 ${width} ${height}`);
    const zoomLayer = svg.append("g");
    const rootGroup = zoomLayer
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 6])
        .on("zoom", (event) => {
          zoomLayer.attr("transform", event.transform.toString());
        }),
    );

    const defaultLinkOpacity = (entry: (typeof bundledPaths)[number]) =>
      entry.link.derived ? 0.95 : 0.35;
    const defaultLinkWidth = (entry: (typeof bundledPaths)[number]) =>
      entry.link.derived ? 2 : 1;
    const highlightLinkOpacity = (entry: (typeof bundledPaths)[number]) =>
      entry.link.derived ? 1 : 0.9;
    const highlightLinkWidth = (entry: (typeof bundledPaths)[number]) =>
      entry.link.derived ? 2.5 : 1.5;

    const linkSelection = rootGroup
      .append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(bundledPaths)
      .join("path")
      .attr("d", (entry) => line(entry.points) || "")
      .attr("stroke", (entry) =>
        entry.link.derived
          ? "#00BFFF"
          : colorByDomain(entry.sourceLeaf?.universalDomain ?? "other")
      )
      .attr("stroke-width", (entry) => defaultLinkWidth(entry))
      .attr("stroke-opacity", (entry) => defaultLinkOpacity(entry));

    const restoreLinkStyles = () => {
      linkSelection
        .attr("stroke-width", (entry) => defaultLinkWidth(entry))
        .attr("stroke-opacity", (entry) => defaultLinkOpacity(entry));
      leafGroup.style("opacity", null);
    };

    const highlightLeaf = (leafPath: string) => {
      linkSelection
        .attr("stroke-opacity", (entry) =>
          entry.link.sourcePath === leafPath || entry.link.targetPath === leafPath
            ? highlightLinkOpacity(entry)
            : 0.08,
        )
        .attr("stroke-width", (entry) =>
          entry.link.sourcePath === leafPath || entry.link.targetPath === leafPath
            ? highlightLinkWidth(entry)
            : defaultLinkWidth(entry),
        );
      leafGroup.style("opacity", (node) => (hierarchyPath(node) === leafPath ? 1 : 0.25));
    };

    const leafGroup = rootGroup
      .append("g")
      .selectAll("g")
      .data(leafNodes)
      .join("g")
      .attr("transform", (node) => {
        const angle = (node.x * 180) / Math.PI - 90;
        return `rotate(${angle}) translate(${node.y},0)`;
      });

    leafGroup
      .append("circle")
      .attr("r", 2.5)
      .attr("fill", (node) =>
        colorByDomain(leafByPath.get(hierarchyPath(node))?.universalDomain ?? "other")
      )
      .attr("opacity", 0.95)
      .style("pointer-events", "none");

    leafGroup
      .append("circle")
      .attr("r", 8)
      .attr("fill", "transparent")
      .style("pointer-events", "all")
      .style("cursor", "pointer")
      .on("mouseenter", (_event, node) => {
        highlightLeaf(hierarchyPath(node));
      })
      .on("mouseleave", () => {
        restoreLinkStyles();
      });

    leafGroup
      .append("text")
      .attr("dy", "0.31em")
      .attr("x", (node) => (node.x < Math.PI ? 6 : -6))
      .attr("text-anchor", (node) => (node.x < Math.PI ? "start" : "end"))
      .attr("transform", (node) => (node.x >= Math.PI ? "rotate(180)" : null))
      .style("font-size", "10px")
      .style("fill", "#334155")
      .style("pointer-events", "none")
      .text((node) => leafByPath.get(hierarchyPath(node))?.label ?? hierarchyPath(node));
  }, [data, dimensions, colorByDomain]);

  return (
    <div ref={containerRef} className={cn("h-full min-h-0 w-full", className)}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="block h-full w-full" />
    </div>
  );
}
