import { describe, expect, test } from "bun:test";
import { createDefaultDiagramDocument } from "@edgeever/shared";
import { compactMindMapNodeSize, computeDiagramLayout } from "./diagram-layout.ts";

describe("diagram auto layout", () => {
  test("places mind-map children to the right of their root", () => {
    const document = createDefaultDiagramDocument("mind-map");
    const positions = computeDiagramLayout(document);
    expect(positions["topic-root"].x).toBeLessThan(positions["topic-1"].x);
    expect(new Set(document.nodes.map((node) => positions[node.id].y)).size).toBeGreaterThan(1);
  });

  test("uses compact topic sizes while allowing longer labels to grow within a cap", () => {
    expect(compactMindMapNodeSize("分支主题", false)).toEqual({ width: 92, height: 36 });
    expect(compactMindMapNodeSize("核心主题", true)).toEqual({ width: 112, height: 42 });
    expect(compactMindMapNodeSize("A much longer topic label", false).width).toBeLessThanOrEqual(156);
  });

  test("orders a connected flow from left to right and keeps detached nodes finite", () => {
    const document = createDefaultDiagramDocument("flowchart");
    document.nodes.push({ id: "detached", label: "Detached", x: 0, y: 0, width: 140, height: 52, shape: "process" });
    const positions = computeDiagramLayout(document);
    expect(positions["flow-start"].x).toBeLessThan(positions["flow-process"].x);
    expect(positions["flow-process"].x).toBeLessThan(positions["flow-end"].x);
    expect(Number.isFinite(positions.detached.x)).toBeTrue();
    expect(Number.isFinite(positions.detached.y)).toBeTrue();
  });
});
