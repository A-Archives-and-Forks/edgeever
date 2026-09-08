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
import type { DiagramStructure, DiagramTheme } from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { MemoEditorToolbarDivider, MemoEditorToolbarRow } from "@/components/MemoEditorToolbarChrome";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveDiagramPalette, type DiagramAppearance } from "@/lib/diagram-theme";

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
        <Select value={structure === "box" ? "box" : "map"} disabled={readOnly} onValueChange={(value) => onStructureChange(value as DiagramStructure)}>
          <Tooltip>
            <TooltipTrigger asChild>
              <SelectTrigger className="h-8 w-[8.5rem] gap-2" aria-label={t("diagram.structure")}>
                <SelectValue />
              </SelectTrigger>
            </TooltipTrigger>
            <TooltipContent>{t("diagram.structure")}</TooltipContent>
          </Tooltip>
          <SelectContent>
            <SelectItem value="map" textValue={t("diagram.structureMap")}><span className="flex items-center gap-2"><span className="h-3 w-3 border-b-2 border-slate-500" />{t("diagram.structureMap")}</span></SelectItem>
            <SelectItem value="box" textValue={t("diagram.structureBox")}><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-slate-400" />{t("diagram.structureBox")}</span></SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      <Select value={theme === "classic" ? "classic" : "brand"} disabled={readOnly} onValueChange={(value) => onThemeChange(value as DiagramTheme)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SelectTrigger className="h-8 w-[8.5rem] gap-2" aria-label={t("diagram.theme")}>
              <SelectValue />
            </SelectTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("diagram.theme")}</TooltipContent>
        </Tooltip>
        <SelectContent>
          <SelectItem value="brand" textValue={t("diagram.themeBrand")}><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-black/10" style={{ background: resolveDiagramPalette("brand", appearance).topicFill }} />{t("diagram.themeBrand")}</span></SelectItem>
          <SelectItem value="classic" textValue={t("diagram.themeClassic")}><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-black/10" style={{ background: "conic-gradient(#16A06E, #3B82F6, #8B5CF6, #F59E0B, #EC4899, #16A06E)" }} />{t("diagram.themeClassic")}</span></SelectItem>
        </SelectContent>
      </Select>
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
