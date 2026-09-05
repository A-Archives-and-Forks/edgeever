import { useCallback, useEffect, useRef, useState } from "react";
import { Export, Graph, History, Keyboard, Selection, type Edge, type Node } from "@antv/x6";
import {
  ArrowLeft,
  Box,
  Circle,
  Diamond,
  Download,
  FileCode2,
  FileImage,
  GitBranch,
  LayoutDashboard,
  Maximize2,
  Redo2,
  Save,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DIAGRAM_SCHEMA_VERSION,
  diagramFallbackMarkdown,
  markdownToDoc,
  parseDiagramDocument,
  serializeDiagramDocument,
  type DiagramDocument,
  type DiagramNodeShape,
  type DiagramTheme,
  type MemoDetail,
  type MemoEditSession,
} from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppConfirmDialog } from "@/components/dialogs/ConfirmDialogs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { compactMindMapNodeSize, computeDiagramLayout } from "@/lib/diagram-layout";
import { isLocalMemoId } from "@/lib/local-mirror";
import { isBrowserOffline } from "@/lib/network-status";
import type { EdgeEverRepository } from "@/lib/repository";
import { cn } from "@/lib/utils";

type DiagramEditorPaneProps = {
  memo: MemoDetail;
  repository: EdgeEverRepository;
  readOnly: boolean;
  onBackToList: () => void;
  onSaved: (memo: MemoDetail) => Promise<void>;
};

type NodeData = { label: string; shape: DiagramNodeShape; parentId?: string };
type MindMapInsertRelation = "child" | "sibling";
type NodeEditorState = {
  nodeId: string;
  originalValue: string;
  value: string;
  shape: DiagramNodeShape;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  background: string;
  borderColor: string;
};

const BRAND_GREEN = "#16A06E";
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const DIAGRAM_THEMES: Record<DiagramTheme, {
  topicFill: string;
  topicText: string;
  nodeFill: string;
  nodeText: string;
  nodeStroke: string;
  topicStroke: string;
  mindMapEdge: string;
  flowEdge: string;
  canvas: string;
  grid: string;
  gridStrong: string;
}> = {
  brand: {
    topicFill: BRAND_GREEN,
    topicText: "#FFFFFF",
    nodeFill: "#F0F8F4",
    nodeText: "#173B2E",
    nodeStroke: "#B8DFD0",
    topicStroke: "#12845B",
    mindMapEdge: "#55B891",
    flowEdge: "#408A6D",
    canvas: "#F8FAF9",
    grid: "#E6EEE9",
    gridStrong: "#CFDDD5",
  },
  ocean: {
    topicFill: "#DEF1E9",
    topicText: "#0F4432",
    nodeFill: "#FFFEFA",
    nodeText: "#26352E",
    nodeStroke: "#D5E3DB",
    topicStroke: BRAND_GREEN,
    mindMapEdge: "#8ACCB2",
    flowEdge: "#6B9281",
    canvas: "#FBFCFA",
    grid: "#EBF0EC",
    gridStrong: "#D9E3DC",
  },
  ink: {
    topicFill: "#16A06E",
    topicText: "#F5FBF8",
    nodeFill: "#19261F",
    nodeText: "#E5EEE9",
    nodeStroke: "#3C594A",
    topicStroke: "#68D6B0",
    mindMapEdge: "#58BA94",
    flowEdge: "#68A78D",
    canvas: "#101512",
    grid: "#202B25",
    gridStrong: "#304038",
  },
};

const diagramGrid = (theme: DiagramTheme) => ({
  visible: true,
  type: "doubleMesh" as const,
  args: [
    { color: DIAGRAM_THEMES[theme].grid, thickness: 1 },
    { color: DIAGRAM_THEMES[theme].gridStrong, thickness: 1, factor: 5 },
  ],
});

const applyDiagramSurface = (graph: Graph, theme: DiagramTheme, kind: DiagramDocument["kind"]) => {
  graph.drawBackground({ color: DIAGRAM_THEMES[theme].canvas });
  if (kind === "flowchart") graph.drawGrid(diagramGrid(theme));
  else graph.clearGrid();
};

const prepareExportSvg = (background: string) => (svg: SVGSVGElement) => {
  svg.querySelectorAll(".x6-port").forEach((element) => element.remove());
  const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) return;
  const [x, y, width, height] = viewBox;
  const rect = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(height));
  rect.setAttribute("fill", background);
  svg.insertBefore(rect, svg.firstChild);
};

const createLocalEditSession = (memo: MemoDetail): MemoEditSession => ({
  id: `local-edit:${memo.id}`,
  memoId: memo.id,
  baseRevision: memo.revision,
  baseContentHash: memo.contentHash,
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
});

const nodeEditorState = (graph: Graph, node: Node, theme: DiagramTheme): NodeEditorState => {
  const data = node.getData<NodeData>();
  const bbox = node.getBBox();
  const topLeft = graph.localToGraph({ x: bbox.x, y: bbox.y });
  const bottomRight = graph.localToGraph({ x: bbox.x + bbox.width, y: bbox.y + bbox.height });
  const isRootTopic = data?.shape === "topic" && !data.parentId;
  const attrs = nodeAttrs(data?.shape ?? "process", theme, isRootTopic);
  return {
    nodeId: node.id,
    originalValue: data?.label ?? "",
    value: data?.label ?? "",
    shape: data?.shape ?? "process",
    left: topLeft.x,
    top: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
    fontSize: 14 * graph.scale().sx,
    color: String(attrs.label.fill),
    background: String(attrs.body.fill),
    borderColor: String(attrs.body.stroke),
  };
};

const nodeAttrs = (shape: DiagramNodeShape, theme: DiagramTheme, isRootTopic = false) => {
  const palette = DIAGRAM_THEMES[theme];
  const isTerminator = shape === "terminator";
  const isAccent = isRootTopic || isTerminator;
  return {
    body: {
      fill: isAccent ? palette.topicFill : palette.nodeFill,
      stroke: isAccent ? palette.topicStroke : palette.nodeStroke,
      strokeWidth: isAccent ? 1.5 : 1,
      rx: isTerminator ? 24 : 11,
      ry: isTerminator ? 24 : 11,
      ...(shape === "decision" ? { refPoints: "0,10 10,0 20,10 10,20" } : {}),
    },
    label: { fill: isAccent ? palette.topicText : palette.nodeText, fontSize: 14, fontWeight: isAccent ? 650 : 500 },
  };
};

const nodeMetadata = (node: DiagramDocument["nodes"][number], theme: DiagramTheme) => {
  const isDecision = node.shape === "decision";
  const isRootTopic = node.shape === "topic" && !node.parentId;
  const visualAttrs = nodeAttrs(node.shape, theme, isRootTopic);
  const palette = DIAGRAM_THEMES[theme];
  const size = node.shape === "topic"
    ? compactMindMapNodeSize(node.label, isRootTopic)
    : { width: node.width, height: node.height };
  return {
    id: node.id,
    shape: isDecision ? "polygon" : "rect",
    x: node.x,
    y: node.y,
    width: size.width,
    height: size.height,
    data: { label: node.label, shape: node.shape, ...(node.parentId ? { parentId: node.parentId } : {}) } satisfies NodeData,
    attrs: {
      body: visualAttrs.body,
      label: { ...visualAttrs.label, text: node.label },
    },
    ports: {
      groups: {
        top: { position: "top", attrs: { circle: { r: 4, magnet: true, stroke: palette.topicStroke, fill: palette.canvas, strokeWidth: 1.5 } } },
        right: { position: "right", attrs: { circle: { r: 4, magnet: true, stroke: palette.topicStroke, fill: palette.canvas, strokeWidth: 1.5 } } },
        bottom: { position: "bottom", attrs: { circle: { r: 4, magnet: true, stroke: palette.topicStroke, fill: palette.canvas, strokeWidth: 1.5 } } },
        left: { position: "left", attrs: { circle: { r: 4, magnet: true, stroke: palette.topicStroke, fill: palette.canvas, strokeWidth: 1.5 } } },
      },
      items: ["top", "right", "bottom", "left"].map((group) => ({ id: group, group })),
    },
  };
};

const edgeMetadata = (edge: DiagramDocument["edges"][number], kind: DiagramDocument["kind"], theme: DiagramTheme) => ({
  id: edge.id,
  source: { cell: edge.source },
  target: { cell: edge.target },
  router: kind === "flowchart" ? { name: "manhattan", args: { padding: 20 } } : undefined,
  connector: { name: kind === "mind-map" ? "smooth" : "rounded", args: { radius: 10 } },
  attrs: {
    line: {
      stroke: kind === "mind-map" ? DIAGRAM_THEMES[theme].mindMapEdge : DIAGRAM_THEMES[theme].flowEdge,
      strokeWidth: kind === "mind-map" ? 2 : 1.5,
      targetMarker: kind === "mind-map" ? null : { name: "block", width: 8, height: 6 },
    },
  },
  labels: edge.label ? [{ attrs: {
    label: { text: edge.label, fill: DIAGRAM_THEMES[theme].nodeText, fontSize: 12 },
    body: { fill: DIAGRAM_THEMES[theme].canvas, stroke: DIAGRAM_THEMES[theme].nodeStroke, strokeWidth: 1, rx: 5, ry: 5 },
  } }] : undefined,
});

const graphToDocument = (graph: Graph, kind: DiagramDocument["kind"], theme: DiagramTheme): DiagramDocument => ({
  schemaVersion: DIAGRAM_SCHEMA_VERSION,
  kind,
  theme,
  nodes: graph.getNodes().map((node) => {
    const data = node.getData<NodeData>();
    const position = node.getPosition();
    const size = node.getSize();
    return {
      id: node.id,
      label: data?.label ?? String(node.attr("label/text") ?? ""),
      x: Math.round(position.x),
      y: Math.round(position.y),
      width: Math.round(size.width),
      height: Math.round(size.height),
      shape: data?.shape ?? "process",
      ...(data?.parentId && graph.getCellById(data.parentId)?.isNode() ? { parentId: data.parentId } : {}),
    };
  }),
  edges: graph.getEdges().flatMap((edge) => {
    const source = edge.getSourceCellId();
    const target = edge.getTargetCellId();
    if (!source || !target) return [];
    const label = edge.getLabels()[0]?.attrs?.label?.text;
    return [{ id: edge.id, source, target, ...(typeof label === "string" && label ? { label } : {}) }];
  }),
});

const removeGraphSelection = (graph: Graph) => {
  const selected = graph.getSelectedCells();
  if (selected.length === 0) return false;
  graph.startBatch("remove");
  for (const cell of selected) {
    if (cell.isNode()) graph.removeConnectedEdges(cell);
  }
  graph.removeCells(selected);
  graph.stopBatch("remove");
  return true;
};

const diagramEditorSnapshot = (title: string, document: DiagramDocument) => JSON.stringify({
  title,
  document: {
    ...document,
    theme: document.theme ?? "brand",
    nodes: document.nodes.map((node) => node.shape === "topic"
      ? { ...node, ...compactMindMapNodeSize(node.label, !node.parentId) }
      : node),
  },
});

const fitDiagramContent = (graph: Graph, document: DiagramDocument, container: HTMLElement | null, padding = 32) => {
  graph.zoomToFit({ padding, maxScale: 1 });
  if (document.kind !== "mind-map" || !container) return;
  const root = graph.getNodes().find((node) => !node.getData<NodeData>()?.parentId);
  if (!root) return;
  const rootLeft = graph.localToGraph(root.getBBox().topLeft).x;
  const desiredLeft = Math.max(36, Math.min(96, container.clientWidth * 0.08));
  const translation = graph.translate();
  graph.translate(translation.tx + desiredLeft - rootLeft, translation.ty);
};

const detectGraphTheme = (graph: Graph): DiagramTheme | null => {
  const node = graph.getNodes()[0];
  if (!node) return null;
  const shape = node.getData<NodeData>()?.shape ?? "process";
  const stroke = node.attr("body/stroke");
  return (Object.keys(DIAGRAM_THEMES) as DiagramTheme[]).find((candidate) => {
    const palette = DIAGRAM_THEMES[candidate];
    return stroke === (shape === "topic" ? palette.topicStroke : palette.nodeStroke);
  }) ?? null;
};

export const DiagramEditorPane = ({ memo, repository, readOnly, onBackToList, onSaved }: DiagramEditorPaneProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const insertNodeRef = useRef<(relation: MindMapInsertRelation, baseNodeId?: string) => void>(() => undefined);
  const memoRef = useRef(memo);
  const editSessionRef = useRef<MemoEditSession | null>(null);
  const saveRef = useRef<() => void>(() => undefined);
  const document = parseDiagramDocument(memo.contentMarkdown);
  const documentTheme = document?.theme ?? "brand";
  const [title, setTitle] = useState(memo.title ?? "");
  const [theme, setTheme] = useState<DiagramTheme>(documentTheme);
  const titleRef = useRef(title);
  const themeRef = useRef<DiagramTheme>(documentTheme);
  const savedSnapshotRef = useRef(document ? diagramEditorSnapshot(memo.title ?? "", document) : "");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeLabel, setSelectedNodeLabel] = useState("");
  const [hasSelection, setHasSelection] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editSessionReady, setEditSessionReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [historyState, setHistoryState] = useState({ undo: false, redo: false });
  const [nodeEditor, setNodeEditor] = useState<NodeEditorState | null>(null);
  const nodeEditorRef = useRef<NodeEditorState | null>(null);

  const beginNodeEdit = useCallback((node: Node) => {
    const graph = graphRef.current;
    if (!graph || readOnly) return;
    const nextEditor = nodeEditorState(graph, node, themeRef.current);
    nodeEditorRef.current = nextEditor;
    setNodeEditor(nextEditor);
  }, [readOnly]);

  const finishNodeEdit = useCallback((cancel = false) => {
    const graph = graphRef.current;
    const current = nodeEditorRef.current;
    nodeEditorRef.current = null;
    setNodeEditor(null);
    if (!graph || !current) return null;
    const cell = graph.getCellById(current.nodeId);
    if (!cell?.isNode()) return null;
    if (!cancel) {
      const label = current.value.trim() || current.originalValue;
      if (label !== current.originalValue) {
        graph.startBatch("edit-label");
        cell.setData({ ...cell.getData<NodeData>(), label });
        cell.attr("label/text", label);
        graph.stopBatch("edit-label");
        setSelectedNodeLabel(label);
      }
    }
    containerRef.current?.focus({ preventScroll: true });
    return cell;
  }, []);

  useEffect(() => {
    setSelectedNodeId(null);
    setSelectedNodeLabel("");
    setHasSelection(false);
    nodeEditorRef.current = null;
    setNodeEditor(null);
    setTheme(documentTheme);
    themeRef.current = documentTheme;
  }, [documentTheme, memo.id]);

  useEffect(() => {
    memoRef.current = memo;
    setTitle(memo.title ?? "");
    titleRef.current = memo.title ?? "";
    savedSnapshotRef.current = document ? diagramEditorSnapshot(memo.title ?? "", document) : "";
    setDirty(false);
    setSaveError(null);
    editSessionRef.current = null;
    setEditSessionReady(false);
    if (readOnly || isLocalMemoId(memo.id) || isBrowserOffline() || window.edgeeverDesktop?.isAvailable) {
      editSessionRef.current = createLocalEditSession(memo);
      setEditSessionReady(true);
      return;
    }
    let cancelled = false;
    void api.createMemoEditSession(memo.id).then(({ editSession }) => {
      if (!cancelled) {
        editSessionRef.current = editSession;
        setEditSessionReady(true);
      }
    }).catch(() => {
      if (!cancelled) setSaveError(t("diagram.editSessionError"));
    });
    return () => { cancelled = true; };
  }, [memo.id, memo.contentHash, memo.revision, readOnly, t]);

  useEffect(() => {
    if (!containerRef.current || !document) return;
    let graph!: Graph;
    graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      async: true,
      background: { color: DIAGRAM_THEMES[documentTheme].canvas },
      grid: document.kind === "flowchart" ? diagramGrid(documentTheme) : false,
      panning: { enabled: true, eventTypes: ["leftMouseDown", "mouseWheel"] },
      mousewheel: { enabled: true, modifiers: ["ctrl", "meta"], minScale: 0.3, maxScale: 2.5 },
      interacting: !readOnly,
      connecting: {
        allowBlank: false,
        allowLoop: false,
        allowNode: true,
        allowEdge: false,
        snap: true,
        router: document.kind === "flowchart" ? "manhattan" : "normal",
        connector: document.kind === "mind-map" ? "smooth" : "rounded",
        createEdge: (): Edge => graph.createEdge(edgeMetadata({ id: createId("edge"), source: "", target: "" }, document.kind, documentTheme)),
      },
    });
    graph.use(new History({ enabled: !readOnly }));
    graph.use(new Export());
    graph.use(new Keyboard({
      enabled: !readOnly,
      global: false,
      guard: (event) => {
        const target = event.target;
        return !(target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)));
      },
    }));
    graph.use(new Selection({ enabled: true, multiple: true, rubberband: true, movable: !readOnly, showNodeSelectionBox: true, showEdgeSelectionBox: true }));
    graph.addNodes(document.nodes.map((node) => nodeMetadata(node, documentTheme)));
    graph.addEdges(document.edges.map((edge) => edgeMetadata(edge, document.kind, documentTheme)));
    graph.cleanHistory();
    if (document.kind === "mind-map") fitDiagramContent(graph, document, containerRef.current);
    else graph.centerContent();

    const updateHistory = () => setHistoryState({ undo: graph.canUndo(), redo: graph.canRedo() });
    const markDirty = () => {
      if (!readOnly) {
        const currentDocument = graphToDocument(graph, document.kind, themeRef.current);
        setDirty(savedSnapshotRef.current !== diagramEditorSnapshot(titleRef.current, currentDocument));
      }
      updateHistory();
    };
    const clearSelectionAfterHistory = () => {
      const nextTheme = detectGraphTheme(graph) ?? themeRef.current;
      themeRef.current = nextTheme;
      setTheme(nextTheme);
      applyDiagramSurface(graph, nextTheme, document.kind);
      graph.cleanSelection();
      setSelectedNodeId(null);
      setSelectedNodeLabel("");
      setHasSelection(false);
      setDirty(savedSnapshotRef.current !== diagramEditorSnapshot(
        titleRef.current,
        graphToDocument(graph, document.kind, nextTheme),
      ));
    };
    graph.on("model:updated", markDirty);
    graph.on("history:change", updateHistory);
    graph.on("history:undo", clearSelectionAfterHistory);
    graph.on("history:redo", clearSelectionAfterHistory);
    graph.on("node:click", ({ node }: { node: Node }) => {
      const data = node.getData<NodeData>();
      containerRef.current?.focus({ preventScroll: true });
      setSelectedNodeId(node.id);
      setSelectedNodeLabel(data?.label ?? "");
      setHasSelection(true);
    });
    graph.on("node:dblclick", ({ node }: { node: Node }) => beginNodeEdit(node));
    graph.on("edge:click", () => {
      setSelectedNodeId(null);
      setSelectedNodeLabel("");
      setHasSelection(true);
    });
    graph.on("blank:click", () => {
      setSelectedNodeId(null);
      setSelectedNodeLabel("");
      setHasSelection(false);
    });
    graph.bindKey(["backspace", "delete"], (event) => {
      event.preventDefault();
      if (!removeGraphSelection(graph)) return;
      setSelectedNodeId(null);
      setSelectedNodeLabel("");
      setHasSelection(false);
      setDirty(savedSnapshotRef.current !== diagramEditorSnapshot(
        titleRef.current,
        graphToDocument(graph, document.kind, themeRef.current),
      ));
      setHistoryState({ undo: graph.canUndo(), redo: graph.canRedo() });
    });
    graph.bindKey("enter", (event) => {
      event.preventDefault();
      const selected = graph.getSelectedCells().find((cell) => cell.isNode());
      if (document.kind === "mind-map") {
        insertNodeRef.current("sibling", selected?.id);
      } else if (selected?.isNode()) {
        beginNodeEdit(selected);
      }
    });
    if (document.kind === "mind-map") {
      graph.bindKey("tab", (event) => {
        event.preventDefault();
        const selected = graph.getSelectedCells().find((cell) => cell.isNode());
        insertNodeRef.current("child", selected?.id);
      });
    }
    graph.bindKey(["meta+z", "ctrl+z"], (event) => {
      event.preventDefault();
      graph.undo();
      const nextTheme = detectGraphTheme(graph) ?? themeRef.current;
      themeRef.current = nextTheme;
      setTheme(nextTheme);
      applyDiagramSurface(graph, nextTheme, document.kind);
      graph.cleanSelection();
      setSelectedNodeId(null);
      setSelectedNodeLabel("");
      setHasSelection(false);
      setHistoryState({ undo: graph.canUndo(), redo: graph.canRedo() });
      setDirty(savedSnapshotRef.current !== diagramEditorSnapshot(
        titleRef.current,
        graphToDocument(graph, document.kind, nextTheme),
      ));
    });
    graph.bindKey(["meta+shift+z", "ctrl+shift+z"], (event) => {
      event.preventDefault();
      graph.redo();
      const nextTheme = detectGraphTheme(graph) ?? themeRef.current;
      themeRef.current = nextTheme;
      setTheme(nextTheme);
      applyDiagramSurface(graph, nextTheme, document.kind);
      graph.cleanSelection();
      setSelectedNodeId(null);
      setSelectedNodeLabel("");
      setHasSelection(false);
      setHistoryState({ undo: graph.canUndo(), redo: graph.canRedo() });
      setDirty(savedSnapshotRef.current !== diagramEditorSnapshot(
        titleRef.current,
        graphToDocument(graph, document.kind, nextTheme),
      ));
    });
    graphRef.current = graph;
    return () => {
      nodeEditorRef.current = null;
      graphRef.current = null;
      graph.dispose();
    };
  }, [beginNodeEdit, memo.contentHash, memo.id, readOnly]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (readOnly) return;
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [readOnly]);

  const addNode = useCallback((
    shape: DiagramNodeShape = "process",
    options: { relation?: MindMapInsertRelation; baseNodeId?: string; beginEditing?: boolean } = {},
  ) => {
    const graph = graphRef.current;
    if (!graph || !document || readOnly) return;
    const baseNodeId = options.baseNodeId ?? selectedNodeId;
    const selected = baseNodeId
      ? graph.getCellById(baseNodeId) as Node | undefined
      : document.kind === "mind-map"
        ? graph.getNodes()[0]
        : undefined;
    const selectedPosition = selected?.isNode() ? selected.getPosition() : { x: 120, y: 120 };
    const selectedSize = selected?.isNode() ? selected.getSize() : { width: 140, height: 52 };
    const isMindMap = document.kind === "mind-map";
    const selectedData = selected?.isNode() ? selected.getData<NodeData>() : undefined;
    const requestedSibling = isMindMap && options.relation === "sibling" && Boolean(selectedData?.parentId);
    const parent = requestedSibling
      ? graph.getCellById(selectedData?.parentId ?? "") as Node | undefined
      : selected;
    const siblings = requestedSibling
      ? graph.getNodes().filter((node) => node.getData<NodeData>()?.parentId === selectedData?.parentId)
      : [];
    const childNodes = isMindMap && selected?.isNode()
      ? graph.getNodes().filter((node) => node.getData<NodeData>()?.parentId === selected.id)
      : [];
    const nextPosition = requestedSibling
      ? {
          x: selectedPosition.x,
          y: Math.max(selectedPosition.y, ...siblings.map((node) => node.getPosition().y)) + 52,
        }
      : {
          x: selectedPosition.x + selectedSize.width + (isMindMap ? 72 : 110),
          y: childNodes.length > 0
            ? Math.max(...childNodes.map((node) => node.getPosition().y)) + 52
            : selectedPosition.y,
        };
    const id = createId(isMindMap ? "topic" : "node");
    graph.startBatch("add");
    const node = graph.addNode(nodeMetadata({
      id,
      label: isMindMap ? t("diagram.newTopic") : t("diagram.newStep"),
      x: nextPosition.x,
      y: nextPosition.y,
      width: shape === "decision" ? 132 : 140,
      height: shape === "decision" ? 84 : 52,
      shape: isMindMap ? "topic" : shape,
      ...(isMindMap && parent?.isNode() ? { parentId: parent.id } : {}),
    }, themeRef.current));
    if (isMindMap && parent?.isNode()) {
      graph.addEdge(edgeMetadata({ id: createId("branch"), source: parent.id, target: id }, document.kind, themeRef.current));
    }
    if (isMindMap) {
      const positions = computeDiagramLayout(
        graphToDocument(graph, document.kind, themeRef.current),
        requestedSibling && selected?.isNode()
          ? { insertedNodeId: id, insertAfterNodeId: selected.id }
          : {},
      );
      for (const graphNode of graph.getNodes()) {
        const position = positions[graphNode.id];
        if (position) graphNode.position(position.x, position.y);
      }
    }
    graph.stopBatch("add");
    graph.cleanSelection();
    graph.select(node);
    setSelectedNodeId(id);
    setSelectedNodeLabel(node.getData<NodeData>().label);
    setHasSelection(true);
    setDirty(true);
    setHistoryState({ undo: graph.canUndo(), redo: graph.canRedo() });
    if (options.beginEditing) {
      requestAnimationFrame(() => beginNodeEdit(node));
    }
  }, [beginNodeEdit, document, readOnly, selectedNodeId, t]);

  insertNodeRef.current = (relation, baseNodeId) => {
    addNode("topic", { relation, baseNodeId, beginEditing: true });
  };

  const updateSelectedLabel = (label: string) => {
    setSelectedNodeLabel(label);
    const node = selectedNodeId ? graphRef.current?.getCellById(selectedNodeId) : null;
    if (!node?.isNode() || readOnly) return;
    node.setData({ ...node.getData<NodeData>(), label });
    node.attr("label/text", label);
  };

  const removeSelected = () => {
    const graph = graphRef.current;
    if (!graph || readOnly) return;
    if (!removeGraphSelection(graph)) return;
    setSelectedNodeId(null);
    setSelectedNodeLabel("");
    setHasSelection(false);
    if (document) {
      setDirty(savedSnapshotRef.current !== diagramEditorSnapshot(
        titleRef.current,
        graphToDocument(graph, document.kind, themeRef.current),
      ));
    }
    setHistoryState({ undo: graph.canUndo(), redo: graph.canRedo() });
  };

  const runHistoryAction = (action: "undo" | "redo") => {
    const graph = graphRef.current;
    if (!graph || readOnly) return;
    if (action === "undo") graph.undo();
    else graph.redo();
    const nextTheme = detectGraphTheme(graph) ?? themeRef.current;
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    applyDiagramSurface(graph, nextTheme, document?.kind ?? "flowchart");
    graph.cleanSelection();
    setSelectedNodeId(null);
    setSelectedNodeLabel("");
    setHasSelection(false);
    setHistoryState({ undo: graph.canUndo(), redo: graph.canRedo() });
    if (document) {
      setDirty(savedSnapshotRef.current !== diagramEditorSnapshot(
        titleRef.current,
        graphToDocument(graph, document.kind, nextTheme),
      ));
    }
  };

  const applyAutoLayout = () => {
    const graph = graphRef.current;
    if (!graph || !document || readOnly || graph.getNodes().length === 0) return;
    const positions = computeDiagramLayout(graphToDocument(graph, document.kind, themeRef.current));
    graph.startBatch("layout");
    let changed = false;
    for (const node of graph.getNodes()) {
      const position = positions[node.id];
      if (!position) continue;
      const currentPosition = node.getPosition();
      if (currentPosition.x !== position.x || currentPosition.y !== position.y) {
        changed = true;
        node.position(position.x, position.y);
      }
    }
    graph.stopBatch("layout");
    fitDiagramContent(graph, document, containerRef.current, 40);
    if (changed) {
      setDirty(savedSnapshotRef.current !== diagramEditorSnapshot(
        titleRef.current,
        graphToDocument(graph, document.kind, themeRef.current),
      ));
      setHistoryState({ undo: graph.canUndo(), redo: graph.canRedo() });
    }
  };

  const applyTheme = (nextTheme: DiagramTheme) => {
    const graph = graphRef.current;
    if (nextTheme === theme) return;
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    if (!graph || readOnly) return;
    graph.startBatch("update");
    for (const node of graph.getNodes()) {
      const data = node.getData<NodeData>();
      const shape = data?.shape ?? "process";
      const attrs = nodeAttrs(shape, nextTheme, shape === "topic" && !data?.parentId);
      node.attr("body", attrs.body);
      node.attr("label", { ...attrs.label, text: data?.label ?? "" });
      for (const port of node.getPorts()) {
        if (!port.id) continue;
        node.portProp(port.id, "attrs/circle", {
          stroke: DIAGRAM_THEMES[nextTheme].topicStroke,
          fill: DIAGRAM_THEMES[nextTheme].canvas,
        });
      }
    }
    for (const edge of graph.getEdges()) {
      edge.attr("line/stroke", document?.kind === "mind-map"
        ? DIAGRAM_THEMES[nextTheme].mindMapEdge
        : DIAGRAM_THEMES[nextTheme].flowEdge);
      if (edge.getLabels().length > 0) {
        edge.attr("label/fill", DIAGRAM_THEMES[nextTheme].nodeText);
        edge.attr("body/fill", DIAGRAM_THEMES[nextTheme].canvas);
        edge.attr("body/stroke", DIAGRAM_THEMES[nextTheme].nodeStroke);
      }
    }
    applyDiagramSurface(graph, nextTheme, document?.kind ?? "flowchart");
    graph.stopBatch("update");
    setDirty(savedSnapshotRef.current !== diagramEditorSnapshot(
      titleRef.current,
      graphToDocument(graph, document?.kind ?? "flowchart", nextTheme),
    ));
  };

  const exportDiagram = (format: "png" | "svg") => {
    const graph = graphRef.current;
    if (!graph || !document) return;
    const fallbackName = document.kind === "mind-map" ? t("diagram.mindMap") : t("diagram.flowchart");
    const fileName = (title.trim() || fallbackName).replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
    setSaveError(null);
    try {
      const palette = DIAGRAM_THEMES[themeRef.current];
      const beforeSerialize = prepareExportSvg(palette.canvas);
      if (format === "png") {
        graph.exportPNG(fileName, { backgroundColor: palette.canvas, padding: 32, ratio: 2, copyStyles: false, beforeSerialize });
      } else {
        graph.exportSVG(fileName, { preserveDimensions: true, copyStyles: false, beforeSerialize });
      }
    } catch {
      setSaveError(t("diagram.exportError"));
    }
  };

  const save = async () => {
    const graph = graphRef.current;
    const currentMemo = memoRef.current;
    const editSession = editSessionRef.current;
    if (!graph || !document || !editSession || readOnly || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const nextDocument = graphToDocument(graph, document.kind, themeRef.current);
      const markdown = serializeDiagramDocument(nextDocument);
      const nextTitle = titleRef.current;
      const result = await repository.updateMemo(currentMemo, {
        expectedRevision: currentMemo.revision,
        expectedContentHash: currentMemo.contentHash,
        editSessionId: editSession.id,
        title: nextTitle,
        contentJson: markdownToDoc(diagramFallbackMarkdown(nextDocument)),
        contentMarkdown: markdown,
        tags: currentMemo.tags,
      });
      memoRef.current = result.memo;
      savedSnapshotRef.current = diagramEditorSnapshot(nextTitle, nextDocument);
      setDirty(false);
      graph.cleanHistory();
      setHistoryState({ undo: false, redo: false });
      await onSaved(result.memo);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("diagram.saveError"));
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = () => { void save(); };

  if (!document) return null;
  const kindLabel = document.kind === "mind-map" ? t("diagram.mindMap") : t("diagram.flowchart");

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" aria-label={t("diagram.back")} onClick={() => dirty ? setConfirmDiscardOpen(true) : onBackToList()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("diagram.back")}</TooltipContent>
        </Tooltip>
        <div className="hidden rounded-full border border-[var(--brand-green-border)] bg-[var(--brand-green-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-green-text)] sm:block">{kindLabel}</div>
        <input
          className="min-w-0 flex-1 bg-transparent px-2 text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400 disabled:text-slate-600"
          value={title}
          disabled={readOnly}
          maxLength={160}
          placeholder={kindLabel}
          aria-label={t("diagram.title")}
          onChange={(event) => {
            const nextTitle = event.target.value;
            titleRef.current = nextTitle;
            setTitle(nextTitle);
            const graph = graphRef.current;
            if (graph) {
              setDirty(savedSnapshotRef.current !== diagramEditorSnapshot(
                nextTitle,
                graphToDocument(graph, document.kind, themeRef.current),
              ));
            }
          }}
        />
        <span className={cn("hidden text-xs sm:block", saveError ? "text-rose-600" : dirty ? "text-amber-600" : "text-slate-400")}>{saveError ?? (dirty ? t("diagram.unsaved") : t("diagram.saved"))}</span>
        {!readOnly && (
          <Button variant="solid" size="sm" disabled={!dirty || saving || !editSessionReady} onClick={() => void save()}>
            <Save className="h-4 w-4" />
            {saving ? t("diagram.saving") : t("diagram.save")}
          </Button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-3 py-2">
          {!readOnly && (
            document.kind === "mind-map" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="soft" onClick={() => addNode("topic")}><GitBranch className="h-4 w-4" />{t("diagram.addTopic")}</Button>
                </TooltipTrigger>
                <TooltipContent>{t("diagram.mindMapShortcuts")}</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Button size="sm" variant="soft" onClick={() => addNode("process")}><Box className="h-4 w-4" />{t("diagram.addStep")}</Button>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" aria-label={t("diagram.addDecision")} onClick={() => addNode("decision")}><Diamond className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.addDecision")}</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" aria-label={t("diagram.addTerminator")} onClick={() => addNode("terminator")}><Circle className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.addTerminator")}</TooltipContent></Tooltip>
              </>
            )
          )}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.undo")} disabled={!historyState.undo || readOnly} onClick={() => runHistoryAction("undo")}><Undo2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.undo")}</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.redo")} disabled={!historyState.redo || readOnly} onClick={() => runHistoryAction("redo")}><Redo2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.redo")}</TooltipContent></Tooltip>
          {!readOnly && <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.deleteSelection")} disabled={!hasSelection} onClick={removeSelected}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.deleteSelection")}</TooltipContent></Tooltip>}
          {!readOnly && <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.autoLayout")} onClick={applyAutoLayout}><LayoutDashboard className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.autoLayout")}</TooltipContent></Tooltip>}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.zoomOut")} onClick={() => graphRef.current?.zoom(-0.1)}><ZoomOut className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.zoomOut")}</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.zoomIn")} onClick={() => graphRef.current?.zoom(0.1)}><ZoomIn className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.zoomIn")}</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.fit")} onClick={() => { const graph = graphRef.current; if (graph) fitDiagramContent(graph, document, containerRef.current); }}><Maximize2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.fit")}</TooltipContent></Tooltip>
          <Select value={theme} disabled={readOnly} onValueChange={(value) => applyTheme(value as DiagramTheme)}>
            <SelectTrigger className="h-8 w-[8.5rem] gap-2" aria-label={t("diagram.theme")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="brand" textValue={t("diagram.themeBrand")}><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-black/10" style={{ background: DIAGRAM_THEMES.brand.topicFill }} />{t("diagram.themeBrand")}</span></SelectItem>
              <SelectItem value="ocean" textValue={t("diagram.themeOcean")}><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-black/10" style={{ background: DIAGRAM_THEMES.ocean.topicFill }} />{t("diagram.themeOcean")}</span></SelectItem>
              <SelectItem value="ink" textValue={t("diagram.themeInk")}><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-black/10" style={{ background: DIAGRAM_THEMES.ink.nodeFill }} />{t("diagram.themeInk")}</span></SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline"><Download className="h-4 w-4" />{t("diagram.export")}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => exportDiagram("png")}><FileImage className="h-4 w-4" />{t("diagram.exportPng")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportDiagram("svg")}><FileCode2 className="h-4 w-4" />{t("diagram.exportSvg")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {selectedNodeId && !readOnly && (
            <div className="ml-auto flex min-w-[220px] flex-1 items-center gap-2 sm:max-w-sm">
              <span className="shrink-0 text-xs font-medium text-slate-500">{t("diagram.nodeText")}</span>
              <Input value={selectedNodeLabel} maxLength={120} onChange={(event) => updateSelectedLabel(event.target.value)} />
            </div>
          )}
        </div>
        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="edgeever-diagram-canvas absolute inset-0 touch-none outline-none" data-diagram-theme={theme} tabIndex={0} aria-label={t("diagram.canvas", { type: kindLabel })} />
          {nodeEditor ? (
            <input
              autoFocus
              className="absolute z-20 px-3 text-center font-medium outline-none"
              style={{
                left: nodeEditor.left,
                top: nodeEditor.top,
                width: nodeEditor.width,
                height: nodeEditor.height,
                fontSize: nodeEditor.fontSize,
                color: nodeEditor.color,
                background: nodeEditor.background,
                border: `2px solid ${nodeEditor.borderColor}`,
                borderRadius: nodeEditor.shape === "terminator" ? 999 : 11,
                clipPath: nodeEditor.shape === "decision" ? "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" : undefined,
              }}
              value={nodeEditor.value}
              maxLength={120}
              aria-label={t("diagram.editNode")}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const nextEditor = { ...nodeEditor, value: event.target.value };
                nodeEditorRef.current = nextEditor;
                setNodeEditor(nextEditor);
              }}
              onBlur={() => { finishNodeEdit(); }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  finishNodeEdit(true);
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  const editedNode = finishNodeEdit();
                  if (document.kind === "mind-map" && editedNode) {
                    requestAnimationFrame(() => insertNodeRef.current("sibling", editedNode.id));
                  }
                  return;
                }
                if (event.key === "Tab" && document.kind === "mind-map") {
                  event.preventDefault();
                  const editedNode = finishNodeEdit();
                  if (editedNode) requestAnimationFrame(() => insertNodeRef.current("child", editedNode.id));
                }
              }}
            />
          ) : null}
        </div>
      </div>
        {confirmDiscardOpen ? (
          <AppConfirmDialog
            title={t("diagram.discardTitle")}
            description={t("diagram.discardDescription")}
            confirmLabel={t("diagram.discard")}
            tone="danger"
            onCancel={() => setConfirmDiscardOpen(false)}
            onConfirm={onBackToList}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
};

export default DiagramEditorPane;
