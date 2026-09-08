import { flowchartNodePresentation } from "./diagram-node-presentation";
import {
  FLOWCHART_EDGE_ROUTER,
  FLOWCHART_LABEL_FONT,
  flowchartNodeVisual,
  resolveFlowchartSurface,
} from "./diagram-flowchart-style";
import type { ArchitectureResourceIcon, DiagramDocument, DiagramNodeShape, DiagramTheme } from "./diagram";
import { buildDiagramPalette } from "./diagram-palette";
import {
  MIND_MAP_CONNECTOR_NAME,
  mindMapBranchSides,
  mindMapEdgeTerminal,
  mindMapEdgeVisual,
  mindMapNodePresentation,
  mindMapNodeRole,
  mindMapTopicMarkup,
  resolveMindMapNodeStyle,
} from "./diagram-mindmap-style";

export type DiagramAppearance = "light" | "dark";

export type DiagramPalette = {
  topicFill: string;
  topicText: string;
  nodeFill: string;
  nodeText: string;
  nodeStroke: string;
  topicStroke: string;
  mindMapEdge: string;
  flowEdge: string;
  canvas: string;
};

const BRAND_GREEN = "#16A06E";

export const resolvePortableDiagramPalette = (
  theme: DiagramTheme = "brand",
  appearance: DiagramAppearance = "light",
) => buildDiagramPalette(theme, appearance);

const architectureAccent: Partial<Record<DiagramNodeShape, string>> = {
  client: "#0891B2",
  frontend: "#2563EB",
  service: BRAND_GREEN,
  database: "#7C3AED",
  storage: "#D97706",
  queue: "#EA580C",
  security: "#E11D48",
  external: "#64748B",
};

// Native X6 viewers do not bundle React icon components. These compact,
// monochrome glyphs preserve each resource's visual identity in that portable
// projection while the Web editor renders the matching Lucide pictogram.
const architectureResourceGlyphs: Record<ArchitectureResourceIcon, string> = {
  client: "▣", webApp: "▤", mobileApp: "▯", website: "◎", apiClient: "</>",
  service: "▤", virtualMachine: "⚙", container: "⬡", kubernetes: "⌘", serverless: "ƒ",
  relationalDatabase: "◉", noSqlDatabase: "ϟ", cache: "▱", dataWarehouse: "▥", searchEngine: "⌕",
  objectStorage: "☁", fileStorage: "▧", blockStorage: "▰", backup: "↶", cdn: "⇧",
  messageQueue: "≡", eventBus: "⑂", streamProcessing: "≋", webhook: "⌁", serviceMesh: "⋮",
  apiGateway: "⇄", loadBalancer: "↔", dns: "◎", vpc: "◇", subnet: "⊞", vpn: "⌁",
  identity: "◆", firewall: "▦", waf: "✓", secretManager: "⌑", certificate: "◈", systemBoundary: "□",
  monitoring: "◴", logging: "▤", metrics: "↗", tracing: "∿", alerting: "!",
  saas: "☁", externalApi: "⌁", thirdPartyService: "ϟ",
};

const architectureShapeGlyphs: Partial<Record<DiagramNodeShape, string>> = {
  client: "▣",
  frontend: "▤",
  service: "▥",
  database: "◉",
  storage: "▰",
  queue: "≡",
  security: "✓",
  external: "☁",
};

/** Plain X6 metadata shared by native WebView viewers. */
export const diagramDocumentToX6Cells = (
  document: DiagramDocument,
  appearance: DiagramAppearance,
) => {
  const palette = resolvePortableDiagramPalette(document.theme ?? "brand", appearance);
  const flowchartSurface = document.kind === "flowchart" ? resolveFlowchartSurface(appearance) : null;
  const nodes = document.nodes.map((node) => {
    const mindMapRole = document.kind === "mind-map" ? mindMapNodeRole(document.nodes, node.id) : null;
    const presentation = document.kind === "flowchart"
      ? flowchartNodePresentation(node.shape, node.label)
      : mindMapRole
        ? mindMapNodePresentation(node.label, mindMapRole, document.structure)
        : { width: node.width, height: node.height, text: node.label };
    const mindStyle = mindMapRole
      ? resolveMindMapNodeStyle(document.nodes, node.id, palette, document.theme, appearance, presentation, document.structure)
      : null;
    const mindVisual = mindStyle?.visual ?? null;
    const flowchartVisual = document.kind === "flowchart"
      ? flowchartNodeVisual(node.shape, appearance, presentation)
      : null;
    const isRootTopic = node.shape === "topic" && !node.parentId;
    const isTerminator = node.shape === "terminator";
    const isBoundary = node.shape === "boundary";
    const accent = architectureAccent[node.shape];
    const emphasized = isRootTopic || isTerminator;
    const fill = mindVisual
      ? mindVisual.body.fill
      : flowchartVisual
        ? flowchartVisual.body.fill
      : isBoundary
        ? "transparent"
        : accent
          ? (appearance === "dark" ? palette.nodeFill : `${accent}12`)
          : emphasized ? palette.topicFill : palette.nodeFill;
    const stroke = mindVisual
      ? mindVisual.body.stroke
      : flowchartVisual
        ? flowchartVisual.body.stroke
      : isBoundary ? palette.nodeStroke : accent ?? (emphasized ? palette.topicStroke : palette.nodeStroke);
    const usesArchitectureIcon = document.kind === "architecture" && !isBoundary;
    const iconGlyph = node.resourceIcon
      ? architectureResourceGlyphs[node.resourceIcon]
      : architectureShapeGlyphs[node.shape];
    return {
      id: node.id,
      shape: node.shape === "decision" ? "polygon" : "rect",
      x: node.x,
      y: node.y,
      width: presentation.width,
      height: presentation.height,
      zIndex: isBoundary ? 0 : 2,
      ...(usesArchitectureIcon ? { markup: [
        { tagName: "rect", selector: "body" },
        { tagName: "rect", selector: "iconFrame" },
        { tagName: "text", selector: "resourceIcon" },
        { tagName: "text", selector: "label" },
      ] } : mindMapRole ? { markup: mindMapTopicMarkup(document.structure, mindMapRole) } : {}),
      attrs: {
        body: {
          fill,
          stroke,
          strokeWidth: mindVisual?.body.strokeWidth ?? flowchartVisual?.body.strokeWidth ?? (isBoundary || emphasized || accent ? 1.5 : 1),
          strokeDasharray: isBoundary || node.shape === "external" ? "7 5" : undefined,
          ...(mindVisual?.body ?? flowchartVisual?.body ?? {
            rx: isTerminator ? 24 : node.shape === "database" ? 24 : 11,
            ry: isTerminator ? 24 : node.shape === "database" ? 24 : 11,
          }),
          ...(node.shape === "decision" ? { refPoints: "0,10 10,0 20,10 10,20" } : {}),
        },
        label: {
          text: presentation.text,
          lineHeight: mindVisual?.label.lineHeight ?? flowchartVisual?.label.lineHeight ?? (mindMapRole === "root" ? 20 : 18),
          fill: mindVisual?.label.fill ?? flowchartVisual?.label.fill ?? (emphasized ? palette.topicText : palette.nodeText),
          fontSize: mindVisual?.label.fontSize ?? flowchartVisual?.label.fontSize ?? (node.shape === "topic" ? 14 : isBoundary ? 12 : 13),
          fontWeight: mindVisual?.label.fontWeight ?? flowchartVisual?.label.fontWeight ?? (emphasized || isBoundary || accent ? 650 : 500),
          fontFamily: mindVisual?.label.fontFamily ?? flowchartVisual?.label.fontFamily ?? FLOWCHART_LABEL_FONT,
          ...(mindVisual ? {
            refX: mindVisual.label.refX,
            refY: mindVisual.label.refY,
            textAnchor: mindVisual.label.textAnchor,
            textVerticalAnchor: mindVisual.label.textVerticalAnchor,
          } : {}),
          ...(isBoundary ? { refX: 18, refY: 22, textAnchor: "start", textVerticalAnchor: "middle" } : {}),
          ...(usesArchitectureIcon ? { refX: 54, refY: "50%", textAnchor: "start", textVerticalAnchor: "middle" } : {}),
        },
        ...(mindVisual ? { underline: mindVisual.underline } : {}),
        ...(usesArchitectureIcon ? {
          iconFrame: {
            x: 10,
            y: Math.round((node.height - 34) / 2),
            width: 34,
            height: 34,
            rx: node.shape === "database" ? 17 : node.shape === "security" ? 12 : 8,
            ry: node.shape === "database" ? 17 : node.shape === "security" ? 12 : 8,
            fill: appearance === "dark" ? `${accent}30` : `${accent}18`,
            stroke: "none",
          },
          resourceIcon: {
            text: iconGlyph,
            x: 27,
            y: node.height / 2,
            fill: accent,
            fontSize: iconGlyph === "</>" ? 10 : 17,
            fontWeight: 700,
            textAnchor: "middle",
            textVerticalAnchor: "middle",
          },
        } : {}),
      },
    };
  });
  const projectedById = new Map(nodes.map((node) => [node.id, node]));
  const edges = document.edges.map((edge) => {
    const edgeKind = edge.kind ?? (document.kind === "architecture" ? "dependency" : undefined);
    const sourceNode = projectedById.get(edge.source);
    const targetNode = projectedById.get(edge.target);
    const mindMapSourceRole = document.kind === "mind-map" ? mindMapNodeRole(document.nodes, edge.source) : null;
    const mindMapTargetRole = document.kind === "mind-map" ? mindMapNodeRole(document.nodes, edge.target) : null;
    const branchTint = document.kind === "mind-map"
      ? resolveMindMapNodeStyle(document.nodes, edge.target, palette, document.theme, appearance, { width: 96, height: 36 }, document.structure).tint
      : undefined;
    const mindEdge = mindMapSourceRole ? mindMapEdgeVisual(mindMapSourceRole, palette, branchTint) : null;
    const sides = sourceNode && targetNode
      ? mindMapBranchSides(sourceNode, targetNode)
      : { source: "right" as const, target: "left" as const };
    const sourceTerminal = sourceNode && mindMapSourceRole
      ? mindMapEdgeTerminal(sourceNode, mindMapSourceRole, sides.source, document.structure)
      : null;
    const targetTerminal = targetNode && mindMapTargetRole
      ? mindMapEdgeTerminal(targetNode, mindMapTargetRole, sides.target, document.structure)
      : null;
    const stroke = edgeKind === "data"
      ? "#7C3AED"
      : edgeKind === "async"
        ? "#EA580C"
        : mindEdge?.stroke ?? flowchartSurface?.edge ?? palette.flowEdge;
    return {
      id: edge.id,
      source: document.kind === "mind-map"
        ? { cell: edge.source, ...(sourceTerminal ?? { anchor: { name: sides.source } }) }
        : { cell: edge.source },
      target: document.kind === "mind-map"
        ? { cell: edge.target, ...(targetTerminal ?? { anchor: { name: sides.target } }) }
        : { cell: edge.target },
      router: document.kind === "flowchart" ? FLOWCHART_EDGE_ROUTER : undefined,
      connector: document.kind === "mind-map"
        ? { name: MIND_MAP_CONNECTOR_NAME, args: { sourceWidth: mindEdge?.sourceWidth, targetWidth: mindEdge?.targetWidth } }
        : { name: "rounded", args: { radius: 10 } },
      attrs: { line: {
        stroke,
        strokeWidth: mindEdge ? 0.5 : 1.5,
        strokeDasharray: edgeKind === "async" ? "7 5" : undefined,
        sourceMarker: edge.bidirectional ? { name: "block", width: 8, height: 6 } : null,
        targetMarker: document.kind === "mind-map" ? null : { name: "block", width: 8, height: 6 },
        ...(mindEdge ? {
          fill: stroke,
          strokeLinejoin: "round",
          strokeLinecap: "round",
        } : { fill: "none" }),
      } },
      labels: edge.label ? [{ attrs: {
        label: {
          text: edge.label,
          fill: flowchartSurface?.process.text ?? palette.nodeText,
          fontSize: 12,
          lineHeight: 16,
          fontFamily: FLOWCHART_LABEL_FONT,
          textWrap: { width: 140, height: 512 },
        },
        body: {
          ref: "label", refWidth: 1, refHeight: 1, refWidth2: 12, refHeight2: 8, refX: -6, refY: -4,
          fill: flowchartSurface?.canvas ?? palette.canvas,
          stroke: flowchartSurface?.process.stroke ?? palette.nodeStroke,
          strokeWidth: 1, rx: 5, ry: 5,
        },
      } }] : undefined,
    };
  });
  return { canvas: flowchartSurface?.canvas ?? palette.canvas, edges, nodes };
};
