import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const globals = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

describe("image gallery layout", () => {
  test("fills React image node grid cells without exposing a persistent background", () => {
    expect(globals).toContain(
      ".edgeever-image-gallery__content > div > div > .edgeever-image-node {",
    );
    expect(globals).toMatch(
      /\.edgeever-image-gallery__content > div > div > \.edgeever-image-node \{[\s\S]*?width: 100% !important;[\s\S]*?min-width: 0;[\s\S]*?background: transparent;/,
    );
    expect(globals).toMatch(
      /\.edgeever-image-gallery__content > div > div > \.edgeever-image-node > img \{[\s\S]*?width: 100% !important;[\s\S]*?object-fit: cover;/,
    );
  });
});
