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
});

describe("diagram editor canvas surface", () => {
  test("keeps alignment grids for flowcharts without adding visual noise to mind maps", () => {
    expect(source).toContain('grid: document.kind === "flowchart" ? diagramGrid(documentTheme, appearance) : false');
    expect(source).toContain('if (kind === "flowchart") graph.drawGrid(diagramGrid(theme, appearance));');
    expect(source).toContain("else graph.clearGrid();");
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
    expect(source).toContain('graph.startBatch("quick-create")');
  });

  test("repaints the graph when the application appearance changes", () => {
    expect(source).toContain("const { resolvedTheme } = useAppearanceTheme();");
    expect(source).toContain("applyGraphPalette(graph, themeRef.current, document.kind, resolvedTheme);");
    expect(source).toContain("data-diagram-appearance={resolvedTheme}");
    expect(source).toContain("<ThemeToggle />");
  });
});
