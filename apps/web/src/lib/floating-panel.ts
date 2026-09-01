export type FloatingPanelPosition = {
  left: number;
  top: number;
};

export const clampFloatingPanelPosition = (
  position: FloatingPanelPosition,
  panelSize: { height: number; width: number },
  viewportSize: { height: number; width: number },
  edgeGap = 12,
): FloatingPanelPosition => ({
  left: Math.max(edgeGap, Math.min(position.left, viewportSize.width - panelSize.width - edgeGap)),
  top: Math.max(edgeGap, Math.min(position.top, viewportSize.height - panelSize.height - edgeGap)),
});
