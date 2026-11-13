import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFile(join(root, ...parts), "utf8");

function pngDimensions(buffer: Buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("Elite Rewards home-screen installation", () => {
  it("publishes an installable manifest using Elite Rewards icons", async () => {
    const manifest = JSON.parse(await read("public", "manifest.webmanifest"));
    assert.equal(manifest.name, "Elite Rewards");
    assert.equal(manifest.short_name, "Elite Rewards");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.theme_color, "#020713");
    assert.deepEqual(
      manifest.icons.map((icon: { src: string; sizes: string; purpose: string }) => [
        icon.src,
        icon.sizes,
        icon.purpose,
      ]),
      [
        ["/pwa/icon-192.png", "192x192", "any"],
        ["/pwa/icon-512.png", "512x512", "any"],
        ["/pwa/icon-maskable-192.png", "192x192", "maskable"],
        ["/pwa/icon-maskable-512.png", "512x512", "maskable"],
      ],
    );
  });

  it("ships square platform-logo icons at every declared size", async () => {
    const icons = [
      ["icon-192.png", 192],
      ["icon-512.png", 512],
      ["icon-maskable-192.png", 192],
      ["icon-maskable-512.png", 512],
      ["apple-touch-icon.png", 180],
    ] as const;
    for (const [name, size] of icons) {
      const path = join(root, "public", "pwa", name);
      assert.ok((await stat(path)).size > 1_000, `${name} must contain the branded icon`);
      const icon = await readFile(path);
      assert.deepEqual(pngDimensions(icon), { width: size, height: size });
      if (name.startsWith("icon-maskable") || name === "apple-touch-icon.png") {
        assert.equal(icon[25], 2, `${name} must be an opaque RGB PNG`);
      }
    }
  });

  it("links install metadata and exposes an accessible localized install experience", async () => {
    const [rootRoute, component, translations, styles, worker] = await Promise.all([
      read("src", "routes", "__root.tsx"),
      read("src", "components", "AppInstallPrompt.tsx"),
      read("src", "i18n", "index.tsx"),
      read("src", "styles.css"),
      read("public", "sw.js"),
    ]);

    assert.match(rootRoute, /rel: "manifest", href: "\/manifest\.webmanifest"/);
    assert.match(rootRoute, /rel: "apple-touch-icon"/);
    assert.match(rootRoute, /apple-mobile-web-app-capable/);
    assert.match(rootRoute, /<AppInstallPrompt\s*\/>/);
    assert.match(component, /beforeinstallprompt/);
    assert.match(component, /appinstalled/);
    assert.match(component, /navigator\.serviceWorker\.register\("\/sw\.js"/);
    assert.match(component, /role="dialog"/);
    assert.match(component, /aria-modal="true"/);
    assert.match(component, /event\.key === "Escape"/);
    assert.match(component, /Choose Add to Home Screen, then tap Add/);
    assert.match(component, /navigator\.platform === "MacIntel"/);
    assert.match(component, /navigator\.maxTouchPoints > 1/);
    assert.match(translations, /Agregar Elite Rewards a la pantalla de inicio/);
    assert.match(styles, /\.app-install-button/);
    assert.match(styles, /\.app-install-dialog/);
    assert.match(worker, /elite-rewards-shell-/);
    assert.match(worker, /key\.startsWith\(CACHE_PREFIX\)/);
    assert.doesNotMatch(worker, /"\/manifest\.webmanifest"/);
    assert.doesNotMatch(worker, /event\.request\.mode === "navigate"/);
  });
});
