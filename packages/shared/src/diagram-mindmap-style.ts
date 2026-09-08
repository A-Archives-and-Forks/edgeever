import type { DiagramStructure, DiagramTheme } from "./diagram";
import { visualTextUnits } from "./diagram-node-presentation";

export type MindMapRole = "root" | "primary" | "nested";
export type MindMapAppearance = "light" | "dark";

export type MindMapPalette = {
  topicFill: string;
  topicText: string;
  nodeFill: string;
  nodeText: string;
  nodeStroke: string;
  topicStroke: string;
  mindMapEdge: string;
  canvas: string;
};

export type MindMapBranchTint = {
  fill: string;
  stroke: string;
  text: string;
  edge: string;
};

export type MindMapPoint = { x: number; y: number };
export type MindMapBox = { x: number; y: number; width: number; height: number };
export type MindMapIndexedNode = { id: string; parentId?: string; x?: number; y?: number };

export const MIND_MAP_CONNECTOR_NAME = "edgeever-mindmap";
export const MIND_MAP_HORIZONTAL_GAP = 72;
export const MIND_MAP_VERTICAL_GAP = 20;
export const MIND_MAP_LABEL_FONT =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const MIND_MAP_TOPIC_MARKUP = [
  { tagName: "rect", selector: "body" },
  { tagName: "path", selector: "underline" },
  { tagName: "text", selector: "label" },
];

export const MIND_MAP_BRANCH_TINTS: Record<MindMapAppearance, MindMapBranchTint[]> = {
  light: [
    { fill: "#E7F6EF", stroke: "#0F8A5C", text: "#145C40", edge: "#16A06E" },
    { fill: "#E7F0FE", stroke: "#2563EB", text: "#1E3A8A", edge: "#3B82F6" },
    { fill: "#F3E8FF", stroke: "#7C3AED", text: "#5B21B6", edge: "#8B5CF6" },
    { fill: "#FEF3C7", stroke: "#D97706", text: "#92400E", edge: "#F59E0B" },
    { fill: "#FCE7F3", stroke: "#DB2777", text: "#9D174D", edge: "#EC4899" },
    { fill: "#CFFAFE", stroke: "#0E7490", text: "#155E75", edge: "#06B6D4" },
  ],
  dark: [
    { fill: "#1A2A22", stroke: "#4DB58B", text: "#D7F4E8", edge: "#4DB58B" },
    { fill: "#1A2438", stroke: "#60A5FA", text: "#DBEAFE", edge: "#60A5FA" },
    { fill: "#251B38", stroke: "#A78BFA", text: "#EDE9FE", edge: "#A78BFA" },
    { fill: "#2A2114", stroke: "#FBBF24", text: "#FEF3C7", edge: "#FBBF24" },
    { fill: "#2A1520", stroke: "#F472B6", text: "#FCE7F3", edge: "#F472B6" },
    { fill: "#15252B", stroke: "#22D3EE", text: "#CFFAFE", edge: "#22D3EE" },
  ],
};

const wrapVisualText = (label: string, capacity: number) => label.split("\n").flatMap((paragraph) => {
  const lines: string[] = [];
  let line = "";
  for (const character of Array.from(paragraph)) {
    if (line && visualTextUnits(line + character) > capacity) {
      lines.push(line);
      line = "";
    }
    line += character;
  }
  lines.push(line);
  return lines;
});

const formatPoint = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

export const mindMapUsesBranchColors = (theme?: DiagramTheme) => theme === "classic";

export const mindMapUsesUnderline = (role: MindMapRole, structure?: DiagramStructure) => (
  role === "nested" && structure !== "box"
);

export const mindMapNodeRole = (
  nodes: MindMapIndexedNode[],
  nodeId: string,
): MindMapRole => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const node = byId.get(nodeId);
  if (!node?.parentId) return "root";
  const parent = byId.get(node.parentId);
  if (!parent?.parentId) return "primary";
  return "nested";
};

export const mindMapBranchTintIndex = (
  nodes: MindMapIndexedNode[],
  nodeId: string,
): number | null => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const node = byId.get(nodeId);
  if (!node?.parentId) return null;
  let firstLevel = node;
  let current = node;
  const visited = new Set<string>();
  while (current.parentId && byId.has(current.parentId) && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    if (!parent.parentId) {
      firstLevel = current;
      break;
    }
    current = parent;
    firstLevel = current;
  }
  const siblings = nodes
    .filter((item) => item.parentId === firstLevel.parentId)
    .sort((left, right) => (left.y ?? 0) - (right.y ?? 0) || (left.x ?? 0) - (right.x ?? 0) || left.id.localeCompare(right.id));
  const index = siblings.findIndex((item) => item.id === firstLevel.id);
  return index < 0 ? 0 : index;
};

export const mindMapBranchTint = (
  index: number | null,
  appearance: MindMapAppearance,
): MindMapBranchTint | undefined => {
  if (index == null) return undefined;
  const tints = MIND_MAP_BRANCH_TINTS[appearance];
  return tints[index % tints.length];
};

export const mindMapNodeSize = (label: string, role: MindMapRole = "primary", structure?: DiagramStructure) => {
  const isRoot = role === "root";
  const underline = mindMapUsesUnderline(role, structure);
  return {
    width: Math.round(Math.min(
      isRoot ? 180 : 168,
      Math.max(isRoot ? 124 : underline ? 88 : 96, visualTextUnits(label) * 13 + (isRoot ? 36 : underline ? 22 : 28)),
    )),
    height: isRoot ? 46 : underline ? 32 : 36,
  };
};

export const compactMindMapNodeSize = (label: string, isRoot: boolean) => (
  mindMapNodeSize(label, isRoot ? "root" : "primary")
);

export const mindMapNodePresentation = (label: string, role: MindMapRole, structure?: DiagramStructure) => {
  const size = mindMapNodeSize(label, role, structure);
  const underline = mindMapUsesUnderline(role, structure);
  const lineHeight = role === "root" ? 20 : 18;
  const padX = role === "root" ? 36 : underline ? 22 : 28;
  const lines = wrapVisualText(label, Math.max(4, (size.width - padX) / 13));
  return {
    ...size,
    height: Math.max(size.height, lines.length * lineHeight + (role === "root" ? 18 : underline ? 10 : 14)),
    text: lines.join("\n"),
    fontSize: role === "root" ? 15 : role === "primary" ? 14 : 13,
  };
};

export const mindMapRootRadius = (height: number) => Math.round(Math.max(1, height / 2));

export const mindMapUnderlinePath = (width: number, height: number) => (
  `M 1 ${formatPoint(Math.max(2, height - 2))} H ${formatPoint(Math.max(2, width - 1))}`
);

export const mindMapNodeVisual = (
  role: MindMapRole,
  palette: MindMapPalette,
  options: {
    tint?: MindMapBranchTint;
    underline?: boolean;
    structure?: DiagramStructure;
    width?: number;
    height?: number;
  } = {},
) => {
  const underline = options.underline ?? mindMapUsesUnderline(role, options.structure);
  const width = options.width ?? 96;
  const height = options.height ?? (role === "root" ? 46 : underline ? 32 : 36);
  const tint = options.tint;
  if (role === "root") {
    return {
      body: {
        fill: palette.topicFill,
        stroke: palette.topicStroke,
        strokeWidth: 1.5,
        rx: mindMapRootRadius(height),
        ry: mindMapRootRadius(height),
      },
      label: {
        fill: palette.topicText,
        fontSize: 15,
        fontWeight: 650,
        fontFamily: MIND_MAP_LABEL_FONT,
        lineHeight: 20,
        refY: "50%",
        textAnchor: "middle" as const,
        textVerticalAnchor: "middle" as const,
      },
      underline: { d: "", stroke: "none", fill: "none" },
    };
  }
  if (underline) {
    const color = tint?.edge ?? palette.mindMapEdge;
    return {
      body: {
        fill: "transparent",
        stroke: "none",
        strokeWidth: 0,
        rx: 0,
        ry: 0,
      },
      label: {
        fill: tint?.text ?? palette.nodeText,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: MIND_MAP_LABEL_FONT,
        lineHeight: 18,
        refX: "50%",
        refY: height - 6,
        textAnchor: "middle" as const,
        textVerticalAnchor: "bottom" as const,
      },
      underline: {
        d: mindMapUnderlinePath(width, height),
        stroke: color,
        strokeWidth: 1.8,
        fill: "none",
        strokeLinecap: "round",
        pointerEvents: "none",
      },
    };
  }
  if (role === "nested") {
    return {
      body: {
        fill: tint?.fill ?? palette.canvas,
        stroke: tint?.stroke ?? palette.nodeStroke,
        strokeWidth: 1,
        rx: 8,
        ry: 8,
      },
      label: {
        fill: tint?.text ?? palette.nodeText,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: MIND_MAP_LABEL_FONT,
        lineHeight: 18,
        refY: "50%",
        textAnchor: "middle" as const,
        textVerticalAnchor: "middle" as const,
      },
      underline: { d: "", stroke: "none", fill: "none" },
    };
  }
  return {
    body: {
      fill: tint?.fill ?? palette.nodeFill,
      stroke: tint?.stroke ?? palette.topicStroke,
      strokeWidth: 1.5,
      rx: 10,
      ry: 10,
    },
    label: {
      fill: tint?.text ?? palette.nodeText,
      fontSize: 14,
      fontWeight: 650,
      fontFamily: MIND_MAP_LABEL_FONT,
      lineHeight: 18,
      refY: "50%",
      textAnchor: "middle" as const,
      textVerticalAnchor: "middle" as const,
    },
    underline: { d: "", stroke: "none", fill: "none" },
  };
};

export const resolveMindMapNodeStyle = (
  nodes: MindMapIndexedNode[],
  nodeId: string,
  palette: MindMapPalette,
  theme: DiagramTheme | undefined,
  appearance: MindMapAppearance,
  size: { width: number; height: number },
  structure?: DiagramStructure,
) => {
  const role = mindMapNodeRole(nodes, nodeId);
  const underline = mindMapUsesUnderline(role, structure);
  const tint = mindMapUsesBranchColors(theme)
    ? mindMapBranchTint(mindMapBranchTintIndex(nodes, nodeId), appearance)
    : undefined;
  return {
    role,
    underline,
    tint,
    visual: mindMapNodeVisual(role, palette, { tint, underline, structure, width: size.width, height: size.height }),
  };
};

export const mindMapEdgeVisual = (
  sourceRole: MindMapRole,
  palette: MindMapPalette,
  tint?: MindMapBranchTint,
) => {
  const stroke = tint?.edge ?? palette.mindMapEdge;
  if (sourceRole === "root") return { stroke, sourceWidth: 3.1, targetWidth: 1.55 };
  if (sourceRole === "primary") return { stroke, sourceWidth: 1.85, targetWidth: 1.15 };
  return { stroke, sourceWidth: 1.25, targetWidth: 0.9 };
};

export const mindMapBranchSides = (source: MindMapBox, target: MindMapBox) => {
  const sourceCenter = source.x + source.width / 2;
  const targetCenter = target.x + target.width / 2;
  return targetCenter >= sourceCenter
    ? { source: "right" as const, target: "left" as const }
    : { source: "left" as const, target: "right" as const };
};

export const mindMapEdgeTerminal = (
  box: MindMapBox,
  role: MindMapRole,
  side: "left" | "right",
  structure?: DiagramStructure,
) => ({
  anchor: {
    name: side,
    ...(mindMapUsesUnderline(role, structure) ? { args: { dy: box.height / 2 - 2 } } : {}),
  },
  connectionPoint: { name: mindMapUsesUnderline(role, structure) ? "anchor" : "boundary" },
});

const cubicPoint = (p0: MindMapPoint, p1: MindMapPoint, p2: MindMapPoint, p3: MindMapPoint, t: number) => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};

const cubicTangent = (p0: MindMapPoint, p1: MindMapPoint, p2: MindMapPoint, p3: MindMapPoint, t: number) => {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
};

export const mindMapConnectorPath = (
  sourcePoint: MindMapPoint,
  targetPoint: MindMapPoint,
  sourceWidth = 2.4,
  targetWidth = 1.15,
) => {
  const dx = targetPoint.x - sourcePoint.x;
  const dy = targetPoint.y - sourcePoint.y;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
    return `M ${formatPoint(sourcePoint.x)} ${formatPoint(sourcePoint.y)} L ${formatPoint(targetPoint.x)} ${formatPoint(targetPoint.y)}`;
  }
  const controlX = (sourcePoint.x + targetPoint.x) / 2;
  const p0 = sourcePoint;
  const p1 = { x: controlX, y: sourcePoint.y };
  const p2 = { x: controlX, y: targetPoint.y };
  const p3 = targetPoint;
  const samples = 20;
  const left: MindMapPoint[] = [];
  const right: MindMapPoint[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const point = cubicPoint(p0, p1, p2, p3, t);
    const tangent = cubicTangent(p0, p1, p2, p3, t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    const half = ((1 - t) * sourceWidth + t * targetWidth) / 2;
    const nx = -tangent.y / length;
    const ny = tangent.x / length;
    left.push({ x: point.x + nx * half, y: point.y + ny * half });
    right.push({ x: point.x - nx * half, y: point.y - ny * half });
  }
  const start = left[0];
  const commands = [`M ${formatPoint(start.x)} ${formatPoint(start.y)}`];
  for (let index = 1; index < left.length; index += 1) {
    commands.push(`L ${formatPoint(left[index].x)} ${formatPoint(left[index].y)}`);
  }
  for (let index = right.length - 1; index >= 0; index -= 1) {
    commands.push(`L ${formatPoint(right[index].x)} ${formatPoint(right[index].y)}`);
  }
  commands.push("Z");
  return commands.join(" ");
};

export const mindMapConnector = (
  sourcePoint: MindMapPoint,
  targetPoint: MindMapPoint,
  _routePoints?: MindMapPoint[],
  options: { sourceWidth?: number; targetWidth?: number; raw?: boolean } = {},
) => mindMapConnectorPath(
  sourcePoint,
  targetPoint,
  options.sourceWidth,
  options.targetWidth,
);
