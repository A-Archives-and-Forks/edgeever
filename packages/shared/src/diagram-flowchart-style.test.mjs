import { describe, expect, test } from "bun:test";
import { flowchartNodePresentation } from "./diagram-node-presentation.ts";
import {
  FLOWCHART_SURFACES,
  flowchartNodeVisual,
  resolveFlowchartSurface,
} from "./diagram-flowchart-style.ts";

const channel = (value) => {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => channel(Number.parseInt(value, 16)));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe("flowchart semantic paint", () => {
  test("keeps process, decision, and terminator visually distinct", () => {
    for (const appearance of ["light", "dark"]) {
      const surface = resolveFlowchartSurface(appearance);
      expect(surface.process.fill).not.toBe(surface.decision.fill);
      expect(surface.process.fill).not.toBe(surface.terminator.fill);
      expect(surface.decision.stroke).not.toBe(surface.process.stroke);
      expect(surface.terminator.fill).not.toBe("#16A06E");
    }
  });

  test("keeps node labels readable on their fills", () => {
    for (const appearance of ["light", "dark"]) {
      const surface = FLOWCHART_SURFACES[appearance];
      for (const paint of [surface.process, surface.decision, surface.terminator]) {
        expect(contrast(paint.text, paint.fill)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test("uses outlined capsules and Inter for terminator labels", () => {
    const visual = flowchartNodeVisual("terminator", "light", { width: 116, height: 40 });
    expect(visual.body.rx).toBe(20);
    expect(visual.body.fill).toBe(FLOWCHART_SURFACES.light.terminator.fill);
    expect(visual.label.fontFamily).toContain("Inter");
  });
});

describe("flowchart node presentation", () => {
  test("keeps short decision questions on one line", () => {
    const presentation = flowchartNodePresentation("decision", "是结束标记EOS？");
    expect(presentation.text.split("\n")).toEqual(["是结束标记EOS？"]);
    expect(presentation.height).toBeLessThanOrEqual(80);
  });

  test("preserves every character while wrapping long process labels", () => {
    const label = "Transformer 前向计算\n因果注意力＋前馈网络以及更长的说明文字";
    const presentation = flowchartNodePresentation("process", label);
    expect(presentation.text.replaceAll("\n", "")).toBe(label.replaceAll("\n", ""));
    expect(presentation.width).toBeLessThanOrEqual(240);
  });
});
