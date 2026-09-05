import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DiagramEditorPane.tsx", import.meta.url), "utf8");

describe("diagram editor keyboard workflow", () => {
  test("supports direct node editing without routing keystrokes through the side panel", () => {
    expect(source).toContain('graph.on("node:dblclick"');
    expect(source).toContain('aria-label={t("diagram.editNode")}');
    expect(source).toContain('event.key === "Escape"');
  });

  test("keeps the standard mind-map sibling and child shortcuts", () => {
    expect(source).toContain('graph.bindKey("enter"');
    expect(source).toContain('insertNodeRef.current("sibling"');
    expect(source).toContain('graph.bindKey("tab"');
    expect(source).toContain('insertNodeRef.current("child"');
    expect(source).toContain("graph.cleanSelection();\n    graph.select(node);");
  });

  test("supports a complete flowchart keyboard workflow", () => {
    expect(source).toContain('openFlowQuickCreateRef.current = openFlowQuickCreate');
    expect(source).toContain('graph.bindKey("tab"');
    expect(source).toContain('graph.bindKey(["meta+d", "ctrl+d"]');
    expect(source).toContain('graph.startBatch("duplicate")');
    expect(source).toContain('graph.bindKey(["up", "down", "left", "right"');
    expect(source).toContain('graph.bindKey("0"');
    expect(source).toContain('graph.bindKey("1"');
    expect(source).toContain('"1": "process", "2": "decision", "3": "terminator"');
    expect(source).toContain('t("diagram.quickCreateShortcuts")');
  });

  test("continues from text editing into the flowchart node picker", () => {
    expect(source).toContain('else openFlowQuickCreateRef.current(editedNode)');
  });
});

describe("diagram editor canvas surface", () => {
  test("uses a clean grid-free canvas for both diagram types", () => {
    expect(source).toContain("grid: false");
    expect(source).toContain("graph.clearGrid();");
    expect(source).not.toContain("diagramGrid");
    expect(source).not.toContain("graph.drawGrid");
  });

  test("uses straight flowchart edges and presents the content smaller at the left", () => {
    expect(source).toContain('connector: { name: kind === "mind-map" ? "smooth" : "normal" }');
    expect(source).toContain('router: "normal"');
    expect(source).not.toContain('name: "manhattan"');
    expect(source).toContain('maxScale: document.kind === "flowchart" ? 0.84 : 1');
    expect(source).toContain("fitDiagramContent(graph, document, containerRef.current);");
  });

  test("exposes flowchart-only connection handles with safe connection rules", () => {
    expect(source).toContain('kind === "flowchart" ? { ports:');
    expect(source).toContain('allowPort: document.kind === "flowchart"');
    expect(source).toContain('allowBlank: document.kind === "flowchart"');
    expect(source).toContain("allowNode: false");
    expect(source).toContain("allowLoop: false");
    expect(source).toContain("allowMulti: false");
    expect(source).toContain("sourceCell.id !== targetCell.id");
    expect(source).toContain("data-diagram-kind={document.kind}");
  });

  test("turns a connection dropped on blank canvas into a connected-node picker", () => {
    expect(source).toContain('graph.on("edge:connected"');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('t("diagram.quickCreateTitle")');
    expect(source).toContain('createConnectedFlowNode("process")');
    expect(source).toContain('createConnectedFlowNode("decision")');
    expect(source).toContain('createConnectedFlowNode("terminator")');
    expect(source).toContain("draftEdgeId: edge.id");
    expect(source).toContain("removeFlowDraftEdge");
    expect(source).toContain('addEventListener("pointerdown", handleFlowPointerDown, true)');
    expect(source).toContain('addEventListener("pointerup", handleFlowPointerUp, true)');
    expect(source).toContain("graph.clientToLocal(clientPoint)");
    expect(source).toContain('graph.startBatch("quick-create")');
  });

  test("repaints the graph when the application appearance changes", () => {
    expect(source).toContain("const { resolvedTheme } = useAppearanceTheme();");
    expect(source).toContain("applyGraphPalette(graph, themeRef.current, document.kind, resolvedTheme);");
    expect(source).toContain("data-diagram-appearance={resolvedTheme}");
    expect(source).toContain("<ThemeToggle />");
  });
});
