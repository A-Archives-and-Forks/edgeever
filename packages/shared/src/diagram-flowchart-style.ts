import type { DiagramNodeShape } from "./diagram";

export const FLOWCHART_LABEL_FONT =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const FLOWCHART_EDGE_ROUTER = {
  name: "manhattan" as const,
  args: { padding: 8, step: 8, excludeEnds: true },
};

export type FlowchartPortName = "top" | "right" | "bottom" | "left";

export type FlowchartBox = { x: number; y: number; width: number; height: number };

export const flowchartEdgePorts = (
  source: FlowchartBox,
  target: FlowchartBox,
): { source: FlowchartPortName; target: FlowchartPortName } => {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  if (dy < -source.height) return { source: "left", target: "left" };
  if (dx < -source.width) return { source: "top", target: "top" };
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0
      ? { source: "bottom", target: "top" }
      : { source: "top", target: "bottom" };
  }
  return dx >= 0
    ? { source: "right", target: "left" }
    : { source: "left", target: "right" };
};

export const flowchartEdgeIsStraight = (source: FlowchartBox, target: FlowchartBox) => {
  const dx = (target.x + target.width / 2) - (source.x + source.width / 2);
  const dy = (target.y + target.height / 2) - (source.y + source.height / 2);
  if (dy < -source.height || dx < -source.width) return false;
  return (Math.abs(dx) <= 1 && Math.abs(dy) > 8) || (Math.abs(dy) <= 1 && Math.abs(dx) > 8);
};

export const FLOWCHART_LAYOUT_SPACING = { rank: 56, node: 36 };

// Tall flows should stay at reading size. Shrinking the whole graph into the
// viewport makes 12-step notes unreadable; show the start and let the canvas scroll.
export const FLOWCHART_READABLE_MIN_SCALE = 0.85;

export const flowchartFitsReadableViewport = (
  bounds: { width: number; height: number },
  viewport: { width: number; height: number },
  padding = 32,
  minScale = FLOWCHART_READABLE_MIN_SCALE,
  maxScale = 1,
) => {
  const availableWidth = Math.max(viewport.width - padding * 2, 1);
  const availableHeight = Math.max(viewport.height - padding * 2, 1);
  const fitScale = Math.min(
    availableWidth / Math.max(bounds.width, 1),
    availableHeight / Math.max(bounds.height, 1),
    maxScale,
  );
  return fitScale + 1e-6 >= minScale;
};

export type FlowchartAppearance = "light" | "dark";

export type FlowchartShapePaint = {
  fill: string;
  stroke: string;
  text: string;
};

export type FlowchartSurface = {
  canvas: string;
  edge: string;
  process: FlowchartShapePaint;
  decision: FlowchartShapePaint;
  terminator: FlowchartShapePaint;
};

export const FLOWCHART_SURFACES: Record<FlowchartAppearance, FlowchartSurface> = {
  light: {
    canvas: "#F5F8F6",
    edge: "#4A8A6C",
    process: { fill: "#FFFFFF", stroke: "#6F9B88", text: "#1C3D31" },
    decision: { fill: "#FFF6E5", stroke: "#D4A24A", text: "#7A4A12" },
    terminator: { fill: "#E7F6EF", stroke: "#16A06E", text: "#145C40" },
  },
  dark: {
    canvas: "#101311",
    edge: "#7BB89A",
    process: { fill: "#1B2420", stroke: "#5B7569", text: "#E8F2ED" },
    decision: { fill: "#2A2316", stroke: "#E0B35C", text: "#F8E4B8" },
    terminator: { fill: "#1A3329", stroke: "#4DB58B", text: "#D8F3E6" },
  },
};

export const resolveFlowchartSurface = (appearance: FlowchartAppearance = "light") =>
  FLOWCHART_SURFACES[appearance];

export const flowchartShapePaint = (shape: DiagramNodeShape, appearance: FlowchartAppearance) => {
  const surface = resolveFlowchartSurface(appearance);
  if (shape === "decision") return surface.decision;
  if (shape === "terminator") return surface.terminator;
  return surface.process;
};

export const flowchartNodeVisual = (
  shape: DiagramNodeShape,
  appearance: FlowchartAppearance,
  size: { width: number; height: number },
) => {
  const paint = flowchartShapePaint(shape, appearance);
  const terminator = shape === "terminator";
  const decision = shape === "decision";
  return {
    body: {
      fill: paint.fill,
      stroke: paint.stroke,
      strokeWidth: 1.5,
      rx: terminator ? Math.round(size.height / 2) : 10,
      ry: terminator ? Math.round(size.height / 2) : 10,
      ...(decision ? { refPoints: "0,10 10,0 20,10 10,20" } : {}),
    },
    label: {
      fill: paint.text,
      fontSize: 13,
      fontWeight: terminator ? 650 : decision ? 600 : 500,
      fontFamily: FLOWCHART_LABEL_FONT,
      lineHeight: 18,
    },
  };
};
