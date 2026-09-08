import type { DiagramNodeShape } from "./diagram";

export const FLOWCHART_LABEL_FONT =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const FLOWCHART_EDGE_ROUTER = {
  name: "manhattan" as const,
  args: { padding: 16, step: 10 },
};

export const FLOWCHART_LAYOUT_SPACING = { rank: 56, node: 36 };

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
