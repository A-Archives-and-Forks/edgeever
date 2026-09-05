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
    expect(source).toContain('grid: document.kind === "flowchart" ? diagramGrid(documentTheme) : false');
    expect(source).toContain('if (kind === "flowchart") graph.drawGrid(diagramGrid(theme));');
    expect(source).toContain("else graph.clearGrid();");
  });
});
