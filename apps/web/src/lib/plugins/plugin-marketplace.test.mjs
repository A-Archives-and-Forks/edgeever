import { describe, expect, test } from "bun:test";
import { parseMarketplaceRegistry } from "@edgeever/plugin-api";
import { sha256Hex } from "./github-plugin-distribution.ts";

describe("bundled plugin marketplace", () => {
  test("keeps verified checksums aligned with bundled extension files", async () => {
    const registry = parseMarketplaceRegistry(await Bun.file(new URL("../../../public/extensions/registry.json", import.meta.url)).json());
    expect(registry.entries.map((entry) => entry.id)).not.toContain("org.edgeever.examples.recent-notes");
    expect(registry.entries.map((entry) => entry.id)).not.toContain("org.edgeever.themes.nord-emerald");
    for (const entry of registry.entries) {
      if (entry.distribution.type !== "manifest") continue;
      const relativeManifestPath = entry.distribution.manifestUrl.replace(/^\/extensions\//, "");
      const manifestFileUrl = new URL(`../../../public/extensions/${relativeManifestPath}`, import.meta.url);
      const manifestFile = Bun.file(manifestFileUrl);
      expect(await sha256Hex(await manifestFile.text())).toBe(entry.verification.checksums?.manifestJson);
      if (entry.verification.checksums?.mainJs) {
        const mainFile = Bun.file(new URL("./main.js", manifestFileUrl));
        expect(await sha256Hex(await mainFile.text())).toBe(entry.verification.checksums.mainJs);
      }
    }
  });

  test("pins the official AI RSS release and all distributed assets", async () => {
    const registry = parseMarketplaceRegistry(await Bun.file(new URL("../../../public/extensions/registry.json", import.meta.url)).json());
    const entry = registry.entries.find((candidate) => candidate.id === "org.edgeever.plugins.ai-rss");

    expect(entry).toMatchObject({
      publisher: "edgeever",
      repositoryUrl: "https://github.com/tianma-if/edgeever-ai-rss",
      distribution: { type: "github", repositoryUrl: "https://github.com/tianma-if/edgeever-ai-rss" },
      verification: {
        version: "0.5.2",
        checksums: {
          manifestJson: "b8063f246730da33f9cee342670ca776c9319eb5a07585cb44f8641d49caa989",
          mainJs: "46bc00002a647f1f087ac2444e02192ec5ae2d1f04719e027de9386e8bf04934",
          stylesCss: "05cd135a1fe70c3f38d34850a2e9abf6b0c0530b09477960036f567375b2082e",
        },
      },
    });
  });
});
