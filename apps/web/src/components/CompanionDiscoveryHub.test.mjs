import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { zhCN } from "../../../../packages/shared/src/i18n/zh-CN.ts";
import { enUS } from "../../../../packages/shared/src/i18n/en-US.ts";
import { TooltipProvider } from "./ui/tooltip.tsx";
import Hub from "./CompanionDiscoveryHub.tsx";
import { CompanionDiscoverySettingsCard } from "./settings/CompanionDiscoverySettingsCard.tsx";
import { discoverySettingsKey, discoveryFeedKey } from "../hooks/useCompanionDiscovery.ts";

async function render(enabled, locale = "zh-CN", card = false) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  client.setQueryData(discoverySettingsKey("test"), { enabled, version: 0, lastCheckAt: null, lastStatus: "quiet" });
  client.setQueryData(discoveryFeedKey("test"), []);
  const i18n = createInstance(); await i18n.init({ lng: locale, resources: { "zh-CN": { translation: zhCN }, "en-US": { translation: enUS } } });
  const component = card ? createElement(CompanionDiscoverySettingsCard, { scope: "test", onOpenCompanion() {} })
    : createElement(Hub, { scope: "test", onOpenNote() {}, async onNotesChanged() {}, onOpenSettings() {} });
  const result = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client }, createElement(TooltipProvider, {}, component))));
  client.clear(); return result;
}
describe("quiet discovery UI", () => {
  test("disabled means no notification entry or panel", async () => { expect(await render(false)).toBe(""); });
  test("enabled shows only a quiet bell, not an automatically opened dialog", async () => {
    const html = await render(true);
    expect(html).toContain('aria-label="来自 EdgeEver 的发现"');
    expect(html).not.toContain('role="dialog"'); expect(html).not.toContain("有新发现");
  });
  test("Paw mode briefly explains benefits and confirmation without notebook selection", async () => {
    const html = await render(false, "zh-CN", true);
    expect(html).toContain("开启后，EdgeEver 会像猫爪轻推纸片一样，帮你归拢零散碎片、将新想法沉淀到已有笔记、挑出过往的相关灵感。只在有价值时轻量提醒，改动完全由你决定。");
    expect(html).toContain("猫爪模式");
    expect(html).not.toContain("默认模型服务商"); expect(html).not.toContain("24 小时");
    expect(html).toContain('role="switch"'); expect(html).not.toContain('disabled=""');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('role="checkbox"'); expect(html).not.toContain("<fieldset");
    expect(html).toContain("对话与个人记忆");
  });
  test("English settings have matching concise benefits and no raw translation keys", async () => {
    const html = await render(false, "en-US", true);
    expect(html).toContain("When enabled, EdgeEver quietly helps tuck scattered fragments together, append new ideas to existing notes, and surface relevant past insights like a gentle cat paw. It nudges you only when valuable, and all changes remain entirely up to you.");
    expect(html).not.toContain("default model provider"); expect(html).not.toContain("one minute");
    expect(html).not.toContain("companion.discovery."); expect(html).toContain("Paw mode");
  });
  test("checks are event-driven, sync-gated and cancel on cleanup", () => {
    const source = readFileSync(new URL("./CompanionDiscoveryHub.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("setInterval"); expect(source).not.toContain("new Notification");
    expect(source).toContain('document.visibilityState !== "visible"'); expect(source).toContain("await assertCompanionChangesSynced(scope)");
    expect(source).toContain("stop.abort()"); expect(source).toContain("IntersectionObserver");
  });
});
