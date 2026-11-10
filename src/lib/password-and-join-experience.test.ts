import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFile(join(root, ...parts), "utf8");

describe("password visibility and join experience", () => {
  it("uses one accessible eye-toggle password control on every password route", async () => {
    const routesDirectory = join(root, "src", "routes");
    const routeFiles = (await readdir(routesDirectory)).filter((file) => file.endsWith(".tsx"));
    const passwordRoutes: string[] = [];

    for (const file of routeFiles) {
      const source = await readFile(join(routesDirectory, file), "utf8");
      if (
        /password/i.test(source) &&
        /autoComplete=(?:"|\{)"?(?:current|new)-password/.test(source)
      ) {
        passwordRoutes.push(file);
        assert.match(source, /PasswordField/, `${file} must use the shared eye-toggle control`);
        assert.doesNotMatch(
          source,
          /type="password"/,
          `${file} must not bypass the shared control`,
        );
      }
    }

    assert.deepEqual(passwordRoutes.sort(), [
      "activate-client.tsx",
      "activate-member.tsx",
      "join.tsx",
      "login.tsx",
      "reset-password.tsx",
      "setup.tsx",
    ]);
    const component = await read("src", "components", "PasswordField.tsx");
    assert.match(component, /EyeOff/);
    assert.match(component, /Eye/);
    assert.match(component, /aria-label=\{controlLabel\}/);
    assert.match(component, /aria-pressed=\{visible\}/);
    assert.match(component, /minLength = 8/);
  });

  it("keeps the 8-character minimum synchronized across browser and server validation", async () => {
    const [auth, api, i18n, routes] = await Promise.all([
      read("src", "server", "auth.ts"),
      read("src", "server", "api.ts"),
      read("src", "i18n", "index.tsx"),
      Promise.all([
        read("src", "routes", "join.tsx"),
        read("src", "routes", "login.tsx"),
        read("src", "routes", "activate-client.tsx"),
        read("src", "routes", "activate-member.tsx"),
        read("src", "routes", "setup.tsx"),
      ]),
    ]);
    const combined = [auth, api, i18n, ...routes].join("\n");
    assert.match(auth, /password\.length < 8/);
    assert.equal((api.match(/"Password", 8, 200/g) ?? []).length, 5);
    assert.match(api, /"Owner password", 8, 200/);
    assert.match(i18n, /Password must contain between 8 and 200 characters/);
    assert.match(routes[1], /minLength=\{1\}/);
    assert.doesNotMatch(combined, /between 12 and 200|minLength=\{12\}|"Password", 12, 200/);
  });

  it("renders a futuristic tenant-branded Join Rewards scene with a faint business logo", async () => {
    const [route, styles, service, client] = await Promise.all([
      read("src", "routes", "join.tsx"),
      read("src", "styles.css"),
      read("src", "server", "experience-service.ts"),
      read("src", "lib", "api-client.ts"),
    ]);
    assert.match(route, /join-business-watermark/);
    assert.match(route, /join-future-grid/);
    assert.equal((route.match(/className="join-orbit/g) ?? []).length, 2);
    assert.match(route, /referralContext\?\.logoUrl/);
    assert.doesNotMatch(route, /className="modal-icon"/);
    assert.doesNotMatch(route, /className="section-kicker"/);
    assert.doesNotMatch(route, /Sparkles|Users/);
    assert.match(
      styles,
      /body:has\(\.business-join-page\) \.language-switcher[\s\S]*?position: absolute;[\s\S]*?bottom:/,
    );
    assert.match(styles, /\.join-business-watermark\s*\{[\s\S]*?inset: 0;[\s\S]*?opacity: \.08;/);
    assert.match(
      styles,
      /\.join-business-watermark img\s*\{[\s\S]*?width: min\(92vw, 1200px\);[\s\S]*?height: min\(82vh, 900px\);[\s\S]*?object-fit: contain;[\s\S]*?object-position: center;/,
    );
    assert.match(
      styles,
      /@keyframes join-logo-breathe\s*\{\s*from\s*\{\s*transform: scale\(\.98\);[\s\S]*?to\s*\{\s*transform: scale\(1\.03\);/,
    );
    assert.doesNotMatch(styles, /object-fit: cover;\s*transform: scale\(2\.4\)|scale\(2\.[0-9]+\)/);
    assert.match(
      styles,
      /@media \(max-width: 620px\)[\s\S]*?\.join-business-watermark img \{ width: 94vw; height: 78vh; \}/,
    );
    assert.match(styles, /@keyframes join-logo-breathe/);
    assert.match(styles, /@keyframes join-grid-flow/);
    assert.match(styles, /prefers-reduced-motion: reduce/);
    assert.match(service, /logoUrl: row\.has_logo/);
    assert.match(client, /referralEnrollment:[\s\S]*logoUrl: string \| null/);
  });
});
