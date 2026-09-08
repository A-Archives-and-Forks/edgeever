import type { PointerEventHandler, ReactNode } from "react";
import {
  Boxes,
  BookOpen,
  ChevronDown,
  Download,
  FileCode2,
  FileImage,
  Scan,
  Redo2,
  Trash2,
  Undo2,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { DIAGRAM_SELECTABLE_STRUCTURES, DIAGRAM_THEME_GROUPS, diagramThemeSwatches, resolveDiagramTheme, type DiagramStructure, type DiagramTheme } from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { MemoEditorToolbarDivider, MemoEditorToolbarRow } from "@/components/MemoEditorToolbarChrome";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DiagramAppearance } from "@/lib/diagram-theme";
import { cn } from "@/lib/utils";

const STRUCTURE_GROUPS: Array<{ labelKey: "diagram.structureGroupMap" | "diagram.structureGroupLogic"; items: Array<typeof DIAGRAM_SELECTABLE_STRUCTURES[number]> }> = [
  { labelKey: "diagram.structureGroupMap", items: ["map", "line", "capsule", "box", "circle", "ellipse", "hexagon"] },
  { labelKey: "diagram.structureGroupLogic", items: ["logic", "tree", "brace"] },
];

const nodePath = (form: typeof DIAGRAM_SELECTABLE_STRUCTURES[number], x: number, y: number, w: number, h: number) => {
  if (form === "line" || form === "brace" || form === "map") return null;
  if (form === "circle" || form === "ellipse") {
    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />;
  }
  if (form === "hexagon") {
    return <polygon points={`${x + 4},${y} ${x + w - 4},${y} ${x + w},${y + h / 2} ${x + w - 4},${y + h} ${x + 4},${y + h} ${x},${y + h / 2}`} />;
  }
  const rx = form === "capsule" ? h / 2 : 3;
  return <rect x={x} y={y} width={w} height={h} rx={rx} />;
};

const StructureThumb = ({ structure }: { structure: typeof DIAGRAM_SELECTABLE_STRUCTURES[number] }) => {
  const oneSided = structure === "logic" || structure === "tree" || structure === "brace";
  const lineOnly = structure === "line" || structure === "brace" || structure === "map";
  const root = { x: oneSided ? 8 : 38, y: 20, w: oneSided ? 22 : 20, h: 12 };
  const left = [{ x: 6, y: 8 }, { x: 6, y: 32 }];
  const right = oneSided
    ? [{ x: 42, y: 6 }, { x: 42, y: 22 }, { x: 42, y: 38 }]
    : [{ x: 68, y: 8 }, { x: 68, y: 32 }];
  const leaf = { w: 18, h: 10 };
  const cx = root.x + root.w / 2;
  const cy = root.y + root.h / 2;
  return (
    <svg viewBox="0 0 96 56" className="h-12 w-full text-slate-500" fill="currentColor" stroke="currentColor" strokeWidth="1.2">
      <rect x={root.x} y={root.y} width={root.w} height={root.h} rx={3} fill="currentColor" opacity="0.35" stroke="none" />
      {(oneSided ? right : [...left, ...right]).map((item, index) => (
        <g key={index}>
          <path d={`M ${oneSided ? root.x + root.w : (item.x < cx ? root.x : root.x + root.w)} ${cy} C ${item.x + (item.x < cx ? leaf.w : 0)},${cy} ${cx},${item.y + leaf.h / 2} ${item.x + (item.x < cx ? leaf.w : 0)},${item.y + leaf.h / 2}`} fill="none" opacity="0.7" />
          {lineOnly ? (
            <path d={`M ${item.x} ${item.y + leaf.h} H ${item.x + leaf.w}`} fill="none" />
          ) : (
            <g fill="white" stroke="currentColor">{nodePath(structure, item.x, item.y, leaf.w, leaf.h)}</g>
          )}
        </g>
      ))}
    </svg>
  );
};

type DiagramToolbarProps = {
  appearance: DiagramAppearance;
  canRedo: boolean;
  canUndo: boolean;
  hasSelection: boolean;
  leading?: ReactNode;
  onAutoLayout: () => void;
  onDeleteSelection: () => void;
  onExport: (format: "png" | "svg") => void;
  onRedo: () => void;
  onThemeChange: (theme: DiagramTheme) => void;
  showTheme?: boolean;
  onStructureChange?: (structure: DiagramStructure) => void;
  structure?: DiagramStructure;
  onUndo: () => void;
  onRead?: () => void;
  onFit: () => void;
  onResetZoom: () => void;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  readOnly: boolean;
  selectionEditor?: ReactNode;
  theme: DiagramTheme;
};

export const DiagramToolbarAddTrigger = ({
  onPointerEnter,
}: {
  onPointerEnter: PointerEventHandler<HTMLButtonElement>;
}) => {
  const { t } = useTranslation();
  return (
    <DropdownMenuTrigger asChild>
      <Button size="sm" variant="soft" onPointerEnter={onPointerEnter}>
        <Boxes className="h-4 w-4" />
        {t("diagram.componentLibrary")}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </Button>
    </DropdownMenuTrigger>
  );
};

export const DiagramToolbar = ({
  appearance,
  canRedo,
  canUndo,
  hasSelection,
  leading,
  onAutoLayout,
  onDeleteSelection,
  onExport,
  onRedo,
  onThemeChange,
  showTheme = true,
  onStructureChange,
  onUndo,
  onRead,
  onFit,
  onResetZoom,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  readOnly,
  selectionEditor,
  structure,
  theme,
}: DiagramToolbarProps) => {
  const { t } = useTranslation();
  return (
    <MemoEditorToolbarRow className="shrink-0 border-b border-slate-200 bg-white" role="toolbar" aria-label={t("diagram.toolbar")}>
      {leading ? <>{leading}<MemoEditorToolbarDivider /></> : null}
      <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.undo")} disabled={!canUndo || readOnly} onClick={onUndo}><Undo2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.undo")}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.redo")} disabled={!canRedo || readOnly} onClick={onRedo}><Redo2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.redo")}</TooltipContent></Tooltip>
      {!readOnly && <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.deleteSelection")} disabled={!hasSelection} onClick={onDeleteSelection}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.deleteSelection")}</TooltipContent></Tooltip>}
      {!readOnly && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="gap-1.5 px-2.5" aria-label={t("diagram.autoLayout")} onClick={onAutoLayout}>
              <WandSparkles className="h-4 w-4" />
              <span>{t("diagram.autoLayout")}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("diagram.autoLayoutTooltip")}</TooltipContent>
        </Tooltip>
      )}
      <MemoEditorToolbarDivider />
      <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.zoomOut")} onClick={onZoomOut}><ZoomOut className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.zoomOut")}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="w-16 tabular-nums" aria-label={t("diagram.resetZoom")} onClick={onResetZoom}>{zoomPercent}%</Button></TooltipTrigger><TooltipContent>{t("diagram.resetZoom")}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={t("diagram.zoomIn")} onClick={onZoomIn}><ZoomIn className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t("diagram.zoomIn")}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" aria-label={t("diagram.fit")} onClick={onFit}><Scan className="h-4 w-4" /><span>{t("diagram.fit")}</span></Button></TooltipTrigger><TooltipContent>{t("diagram.fit")}</TooltipContent></Tooltip>
      {onRead ? <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={onRead}><BookOpen className="h-4 w-4" />{t("diagram.readFlow")}</Button></TooltipTrigger><TooltipContent>{t("diagram.readFlowHint")}</TooltipContent></Tooltip> : null}
      <MemoEditorToolbarDivider />
      {onStructureChange ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1.5 px-2.5" disabled={readOnly} aria-label={t("diagram.structure")}>
                  {t(`diagram.structure${(structure && DIAGRAM_SELECTABLE_STRUCTURES.includes(structure as typeof DIAGRAM_SELECTABLE_STRUCTURES[number]) ? structure : "map").charAt(0).toUpperCase()}${(structure && DIAGRAM_SELECTABLE_STRUCTURES.includes(structure as typeof DIAGRAM_SELECTABLE_STRUCTURES[number]) ? structure : "map").slice(1)}` as "diagram.structureMap")}
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t("diagram.structure")}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-[22.5rem] p-3">
            {STRUCTURE_GROUPS.map((group) => (
              <div key={group.labelKey} className="mb-3 last:mb-0">
                <div className="mb-1.5 text-xs font-medium text-slate-500">{t(group.labelKey)}</div>
                <div className="grid grid-cols-3 gap-2">
                  {group.items.map((value) => (
                    <DropdownMenuItem
                      key={value}
                      className={cn("h-auto flex-col items-stretch gap-1 rounded-lg border p-1.5", structure === value ? "border-slate-900 bg-slate-50" : "border-slate-200")}
                      onSelect={() => onStructureChange(value)}
                    >
                      <StructureThumb structure={value} />
                    </DropdownMenuItem>
                  ))}
                </div>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {showTheme ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1.5 px-2.5" disabled={readOnly} aria-label={t("diagram.theme")}>
                  <span className="flex h-3.5 overflow-hidden rounded-sm border border-black/10">
                    {diagramThemeSwatches(theme).slice(0, 4).map((color) => (
                      <span key={color} className="h-full w-2.5" style={{ background: color }} />
                    ))}
                  </span>
                  {t(`diagram.theme${resolveDiagramTheme(theme).charAt(0).toUpperCase()}${resolveDiagramTheme(theme).slice(1)}` as "diagram.themeBrand")}
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t("diagram.theme")}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-[18.5rem] p-3">
            {(["vivid", "classic"] as const).map((group) => (
              <div key={group} className="mb-3 last:mb-0">
                <div className="mb-1.5 text-xs font-medium text-slate-500">{t(group === "vivid" ? "diagram.themeGroupVivid" : "diagram.themeGroupClassic")}</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {DIAGRAM_THEME_GROUPS[group].map((value) => (
                    <DropdownMenuItem
                      key={value}
                      className={cn("h-auto items-center gap-3 rounded-lg border px-2 py-1.5", theme === value ? "border-slate-900 bg-slate-50" : "border-transparent")}
                      onSelect={() => onThemeChange(value)}
                    >
                      <span className="flex h-5 flex-1 overflow-hidden rounded-md border border-black/10">
                        {diagramThemeSwatches(value).map((color) => (
                          <span key={`${value}-${color}`} className="h-full flex-1" style={{ background: color }} />
                        ))}
                      </span>
                      <span className="w-10 shrink-0 text-xs text-slate-600">{t(`diagram.theme${value.charAt(0).toUpperCase()}${value.slice(1)}` as "diagram.themeBrand")}</span>
                    </DropdownMenuItem>
                  ))}
                </div>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline"><Download className="h-4 w-4" />{t("diagram.export")}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onExport("png")}><FileImage className="h-4 w-4" />{t("diagram.exportPng")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExport("svg")}><FileCode2 className="h-4 w-4" />{t("diagram.exportSvg")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {selectionEditor}
    </MemoEditorToolbarRow>
  );
};
