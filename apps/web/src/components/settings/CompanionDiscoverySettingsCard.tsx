import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { discoveryFeedKey, discoverySettingsKey, useCompanionDiscoverySettings } from "@/hooks/useCompanionDiscovery";

export function CompanionDiscoverySettingsCard({ scope, onOpenCompanion }: {
  scope: string; onOpenCompanion: () => void;
}) {
  const { t, i18n } = useTranslation();
  const query = useCompanionDiscoverySettings(scope);
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const settings = query.data;
  const enabled = settings?.enabled === true;
  const feed = useQuery({ queryKey: discoveryFeedKey(scope), queryFn: async () => (await api.listCompanionDiscoveries()).items,
    enabled, staleTime: 60_000, retry: false });
  const latest = feed.data?.[0];
  const formatTime = (value: string) => new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "en-US", {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
  const save = async (enabled: boolean) => {
    if (!settings || busy) return;
    setBusy(true); setError(false);
    try {
      const result = await api.saveCompanionDiscoverySettings({ enabled, version: settings.version });
      client.setQueryData(discoverySettingsKey(scope), result.settings);
      client.setQueryData(discoveryFeedKey(scope), []);
    } catch { setError(true); await query.refetch(); }
    finally { setBusy(false); }
  };
  return <Card className="shadow-none">
    <CardHeader className="p-4 sm:p-5">
      <CardTitle className="text-sm">{t("companion.discovery.settingsTitle")}</CardTitle>
      <CardDescription>{t("companion.discovery.description")}</CardDescription>
      <p className="pt-1 text-sm font-medium text-emerald-700">{t("companion.discovery.tagline")}</p>
    </CardHeader>
    <CardContent className="space-y-4 px-4 pb-4 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="companion-discovery-enabled" className="text-sm">{t("companion.discovery.enable")}</label>
        <Switch id="companion-discovery-enabled" checked={settings?.enabled ?? false}
          disabled={busy || !settings}
          onCheckedChange={enabled => void save(enabled)} />
      </div>
      {error || query.isError ? <p role="alert" className="text-sm text-destructive">{t("companion.discovery.settingsFailed")}</p> : null}
      <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4" aria-labelledby="companion-discovery-status-title">
        <div className="flex items-center justify-between gap-3">
          <h3 id="companion-discovery-status-title" className="text-sm font-medium">{t("companion.discovery.transparency.title")}</h3>
          <span className="inline-flex items-center gap-2 text-sm font-medium" role="status">
            <span className={`h-2 w-2 rounded-full ${enabled ? settings?.lastStatus === "failed" ? "bg-rose-500" : settings?.lastStatus === "running" ? "animate-pulse bg-amber-500" : "bg-emerald-500" : "bg-slate-400"}`} />
            {t(`companion.discovery.transparency.state.${enabled ? settings?.lastStatus ?? "quiet" : "disabled"}`)}
          </span>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">{t("companion.discovery.transparency.lastCheck")}</dt>
            <dd className="mt-1 text-slate-700">{settings?.lastCheckAt ? formatTime(settings.lastCheckAt) : t("companion.discovery.transparency.neverChecked")}</dd></div>
          <div><dt className="text-xs text-slate-500">{t("companion.discovery.transparency.nextCheck")}</dt>
            <dd className="mt-1 text-slate-700">{t(enabled ? "companion.discovery.transparency.nextCheckEnabled" : "companion.discovery.transparency.nextCheckDisabled")}</dd></div>
        </dl>
        <p className="text-xs leading-relaxed text-slate-500">{t("companion.discovery.transparency.scope")}</p>
      </section>
      {enabled ? <section className="space-y-3" aria-labelledby="companion-latest-discovery-title">
        <h3 id="companion-latest-discovery-title" className="text-sm font-medium">{t("companion.discovery.transparency.latest")}</h3>
        {feed.isPending ? <p role="status" className="text-sm text-slate-500">{t("common.loading")}</p> : null}
        {feed.isError ? <p role="alert" className="text-sm text-destructive">{t("companion.discovery.loadFailed")}</p> : null}
        {!feed.isPending && !feed.isError && !latest ? <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">{t("companion.discovery.transparency.noDiscovery")}</p> : null}
        {latest ? <article className="space-y-2 rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-emerald-700">{t(`companion.discovery.kind.${latest.kind}`)}</p>
            <time className="text-xs text-slate-500" dateTime={latest.createdAt}>{formatTime(latest.createdAt)}</time>
          </div>
          <h4 className="break-words text-sm font-medium text-slate-900">{latest.title}</h4>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{latest.body}</p>
        </article> : null}
      </section> : null}
      <Button size="sm" variant="ghost" onClick={onOpenCompanion}>{t("companion.discovery.openCompanion")}</Button>
    </CardContent>
  </Card>;
}
