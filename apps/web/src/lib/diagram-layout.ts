import { graphlib, layout as runDagreLayout } from "@dagrejs/dagre";
import type { DiagramDocument } from "@edgeever/shared";

export type DiagramLayoutPositions = Record<string, { x: number; y: number }>;

const visualTextUnits = (label: string) => Array.from(label).reduce(
  (total, character) => total + (/[^\u0000-\u00ff]/.test(character) ? 1 : 0.55),
  0,
);

export const compactMindMapNodeSize = (label: string, isRoot: boolean) => ({
  width: Math.round(Math.min(isRoot ? 168 : 156, Math.max(isRoot ? 112 : 92, visualTextUnits(label) * 13 + 28))),
  height: isRoot ? 42 : 36,
});

export const computeDiagramLayout = (document: DiagramDocument): DiagramLayoutPositions => {
  const layoutGraph = new graphlib.Graph();
  layoutGraph.setGraph({
    rankdir: "LR",
    ranksep: document.kind === "mind-map" ? 72 : 130,
    nodesep: document.kind === "mind-map" ? 24 : 56,
    marginx: 32,
    marginy: 32,
  });
  layoutGraph.setDefaultEdgeLabel(() => ({}));

  for (const node of document.nodes) {
    layoutGraph.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const edge of document.edges) {
    layoutGraph.setEdge(edge.source, edge.target);
  }

  runDagreLayout(layoutGraph);
  return Object.fromEntries(document.nodes.flatMap((node) => {
    const position = layoutGraph.node(node.id) as { x: number; y: number } | undefined;
    if (!position) return [];
    return [[node.id, {
      x: Math.round(position.x - node.width / 2),
      y: Math.round(position.y - node.height / 2),
    }]];
  }));
};
