import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import type { CompanionAction, CompanionDiscoveryItem } from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, ApiRequestError } from "@/lib/api";
import { assertCompanionChangesSynced } from "@/lib/companion-actions";
import { discoveryFeedKey, discoverySettingsKey, useCompanionDiscoverySettings } from "@/hooks/useCompanionDiscovery";
import { CompanionActionCard } from "./CompanionActionCard";

export default function CompanionDiscoveryHub({ scope, onOpenNote, onNotesChanged, onOpenSettings }: {
  scope: string; onOpenNote: (id: string, notebookId: string) => void; onNotesChanged: () => Promise<void>; onOpenSettings: () => void;
}) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const settings = useCompanionDiscoverySettings(scope);
  const enabled = settings.data?.enabled === true;
  const feed = useQuery({ queryKey: discoveryFeedKey(scope), queryFn: async () => (await api.listCompanionDiscoveries()).items,
    enabled, staleTime: 60_000, retry: false });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const lastCheckAt = useRef(settings.data?.lastCheckAt); lastCheckAt.current = settings.data?.lastCheckAt;
  const items = feed.data ?? [];

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    const stop = new AbortController();
    const check = async () => {
      if (running || stop.signal.aborted || document.visibilityState !== "visible" || !navigator.onLine) return;
      if (lastCheckAt.current && Date.now() - Date.parse(lastCheckAt.current) < 86400000) return;
      running = true;
      try {
        await assertCompanionChangesSynced(scope);
        if (stop.signal.aborted) return;
        const result = await api.checkCompanionDiscoveries(i18n.resolvedLanguage ?? "en-US", stop.signal);
        if (!stop.signal.aborted) client.setQueryData(discoveryFeedKey(scope), result.items);
      } catch { /* Quiet by design; check status is visible inside the panel. */ }
      finally {
        running = false;
        if (!stop.signal.aborted) void client.invalidateQueries({ queryKey: discoverySettingsKey(scope) });
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible" && navigator.onLine) timer = setTimeout(() => void check(), 60_000);
    };
    const events = ["keydown", "pointerdown", "input", "online", "edgeever:sync-queue-changed", "edgeever:memo-detail-refreshed"];
    events.forEach(name => window.addEventListener(name, schedule));
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      clearTimeout(timer); stop.abort();
      events.forEach(name => window.removeEventListener(name, schedule));
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [enabled, settings.data?.version, scope, i18n.resolvedLanguage, client]);

  const perform = async (work: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try { await work(); }
    catch (cause) {
      setError(t(cause instanceof ApiRequestError && cause.code === "companion_action_unsynced"
        ? "companion.actions.unsynced" : "companion.discovery.actionFailed"));
    } finally {
      await feed.refetch(); locked.current = false; setBusy(false);
    }
  };
  const apply = (action: CompanionAction) => void perform(async () => {
    await assertCompanionChangesSynced(scope);
    const result = await api.applyCompanionAction(action.id);
    // Persisted receipts remain visible even if local refresh fails.
    client.setQueryData<CompanionDiscoveryItem[]>(discoveryFeedKey(scope), current => current?.map(item => item.action?.id === action.id ? { ...item, action: result.action } : item));
    await onNotesChanged();
  });
  const dismiss = (item: CompanionDiscoveryItem) => void perform(async () => { await api.acknowledgeCompanionDiscovery(item.id, true); });
  const openNote = (id: string, notebookId: string) => { setOpen(false); onOpenNote(id, notebookId); };
  if (!enabled) return null;
  return <>
    <Tooltip><TooltipTrigger asChild>
      <Button variant="outline" size="icon" className="fixed bottom-24 right-4 z-40 h-9 w-9 rounded-full bg-background lg:bottom-4"
        aria-label={t("companion.discovery.title")} onClick={() => { setOpen(true); void feed.refetch(); }}>
        <Bell className="h-4 w-4" aria-hidden="true" />
        {items.some(item => !item.seen && item.action?.status !== "applied") ? <span aria-label={t("companion.discovery.unread")} className="absolute right-0 top-0 h-2 w-2 rounded-full bg-primary" /> : null}
      </Button>
    </TooltipTrigger><TooltipContent>{t("companion.discovery.title")}</TooltipContent></Tooltip>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{t("companion.discovery.title")}</DialogTitle>
          <DialogDescription>{t("companion.discovery.panelDescription")}</DialogDescription></DialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {feed.isError ? <p role="alert" className="text-sm text-destructive">{t("companion.discovery.loadFailed")}</p> : null}
        {!feed.isPending && !feed.isError && !items.length ? <p className="py-6 text-sm text-muted-foreground">{t("companion.discovery.empty")}</p> : null}
        <div className="space-y-4">{items.map(item => <DiscoveryCard key={item.id} item={item} busy={busy} open={open}
          onApply={apply} onDismiss={() => dismiss(item)} onOpenNote={openNote}
          onSeen={() => { void api.acknowledgeCompanionDiscovery(item.id).then(() => client.setQueryData<CompanionDiscoveryItem[]>(discoveryFeedKey(scope),
            current => current?.map(entry => entry.id === item.id ? { ...entry, seen: true } : entry))).catch(() => {}); }} />)}</div>
        <p className="text-xs text-muted-foreground">{t(`companion.discovery.checkStatus.${settings.data?.lastStatus ?? "quiet"}`)}</p>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); onOpenSettings(); }}>{t("companion.settings")}</Button>
      </DialogContent>
    </Dialog>
  </>;
}

function DiscoveryCard({ item, busy, open, onApply, onDismiss, onOpenNote, onSeen }: {
  item: CompanionDiscoveryItem; busy: boolean; open: boolean; onApply: (action: CompanionAction) => void;
  onDismiss: () => void; onOpenNote: (id: string, notebookId: string) => void; onSeen: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const seenCallback = useRef(onSeen); seenCallback.current = onSeen;
  useEffect(() => {
    if (!open || item.seen || !ref.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { seenCallback.current(); observer.disconnect(); }
    }, { threshold: 0.1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [open, item.seen]);
  return <article ref={ref} className="space-y-3 rounded-lg border p-3">
    <p className="text-xs text-muted-foreground">{t(`companion.discovery.kind.${item.kind}`)}</p>
    <h3 className="break-words text-sm font-medium">{item.title}</h3>
    {!item.action ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.body}</p> : null}
    {item.kind === "append" ? <p className="text-xs text-muted-foreground">{t("companion.discovery.appendHelp")}</p> : null}
    {item.action ? <CompanionActionCard action={item.action} busy={busy} onApply={onApply} onDismiss={onDismiss} onOpenNote={onOpenNote} />
      : <div className="flex flex-wrap gap-1">{item.sources.map(source => <Button key={source.id} size="sm" variant="ghost"
        className="h-auto max-w-full whitespace-normal break-words text-left" onClick={() => onOpenNote(source.id, source.notebookId)}>{source.title || t("common.untitledMemo")}</Button>)}</div>}
    <Button size="sm" variant="ghost" disabled={busy} onClick={onDismiss}>{t("companion.discovery.dismiss")}</Button>
  </article>;
}
