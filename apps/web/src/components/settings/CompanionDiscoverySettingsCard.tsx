import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { discoveryFeedKey, discoverySettingsKey, useCompanionDiscoverySettings } from "@/hooks/useCompanionDiscovery";

export function CompanionDiscoverySettingsCard({ scope, onOpenCompanion }: {
  scope: string; onOpenCompanion: () => void;
}) {
  const { t } = useTranslation();
  const query = useCompanionDiscoverySettings(scope);
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const settings = query.data;
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
    </CardHeader>
    <CardContent className="space-y-4 px-4 pb-4 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="companion-discovery-enabled" className="text-sm">{t("companion.discovery.enable")}</label>
        <Switch id="companion-discovery-enabled" checked={settings?.enabled ?? false}
          disabled={busy || !settings}
          onCheckedChange={enabled => void save(enabled)} />
      </div>
      {error || query.isError ? <p role="alert" className="text-sm text-destructive">{t("companion.discovery.settingsFailed")}</p> : null}
      <Button size="sm" variant="ghost" onClick={onOpenCompanion}>{t("companion.discovery.openCompanion")}</Button>
    </CardContent>
  </Card>;
}
