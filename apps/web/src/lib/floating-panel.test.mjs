import { describe, expect, test } from "bun:test";
import { clampFloatingPanelPosition } from "./floating-panel.ts";

describe("clampFloatingPanelPosition", () => {
  test("keeps an in-bounds position unchanged", () => {
    expect(clampFloatingPanelPosition(
      { left: 160, top: 120 },
      { width: 576, height: 420 },
      { width: 1440, height: 900 },
    )).toEqual({ left: 160, top: 120 });
  });

  test("keeps the panel inside every viewport edge", () => {
    expect(clampFloatingPanelPosition(
      { left: 2000, top: 1200 },
      { width: 576, height: 420 },
      { width: 1440, height: 900 },
    )).toEqual({ left: 852, top: 468 });

    expect(clampFloatingPanelPosition(
      { left: -100, top: -80 },
      { width: 576, height: 420 },
      { width: 1440, height: 900 },
    )).toEqual({ left: 12, top: 12 });
  });
});
