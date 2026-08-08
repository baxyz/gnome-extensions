/**
 * Verifies the Donut profile feature against real things — a real
 * filesystem (via the same Node shims check-browsers.ts uses, see
 * scripts/shims/) and a real Gecko browser (Playwright's own Firefox
 * build) — instead of the mocked Gio/GLib the vitest suite uses.
 *
 * What this does and doesn't cover:
 * - createDonutProfile() itself: fully covered. This is the part that
 *   matters most — it's the one thing the mocked unit tests can't actually
 *   prove works, since they never touch a real disk.
 * - The generated user.js actually changing Firefox's behavior
 *   (privacy.resistFingerprinting): covered, but secondary — see the
 *   ROADMAP for why this one pref already covers canvas/WebGL/timezone/
 *   MediaDevices without needing separate checks for each.
 * - NOT covered: the GNOME Shell button/spinner (no St under Node), and
 *   launchDonutBrowser()'s own Gio.Subprocess-based launch against a real
 *   system-installed Firefox/Zen/etc — Playwright can only drive its own
 *   patched Firefox build, not an arbitrary one, so this script launches
 *   the profile directly via Playwright's launchPersistentContext()
 *   instead of going through launchBrowser().
 *
 * Run with: pnpm test:e2e (needs `npx playwright install firefox` once).
 */
import * as fs from "fs";
import assert from "node:assert/strict";
import { firefox } from "playwright";
import { createDonutProfile } from "../src/donut-browser";

async function main() {
  console.log("Creating a Donut profile...");
  const profileDir = await createDonutProfile();

  try {
    assert.ok(fs.statSync(profileDir).isDirectory(), `expected a directory at ${profileDir}`);
    const userJsPath = `${profileDir}/user.js`;
    const userJs = fs.readFileSync(userJsPath, "utf8");
    assert.match(
      userJs,
      /user_pref\("privacy\.resistFingerprinting", true\);/,
      "user.js should enable privacy.resistFingerprinting",
    );
    console.log(`✅ profile created on disk at ${profileDir}, with a real user.js`);

    console.log("Launching Firefox with it as the profile...");
    const context = await firefox.launchPersistentContext(profileDir, { headless: true });
    try {
      const page = await context.newPage();
      await page.goto("about:blank");

      // The clearest, most deterministic resistFingerprinting signal to
      // assert on — canvas/WebGL spoofing is randomized by design (that's
      // the point), so there's no single expected value to compare against
      // without a second, unprotected profile as a baseline.
      const timezone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
      assert.equal(
        timezone,
        "Atlantic/Reykjavik",
        "privacy.resistFingerprinting should spoof the timezone",
      );
      console.log("✅ Firefox accepted the profile and privacy.resistFingerprinting is in effect");
    } finally {
      await context.close();
    }
  } finally {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }

  console.log("\nAll good.");
}

main().catch((e: unknown) => {
  console.error("❌ Donut e2e check failed:");
  console.error(e);
  process.exitCode = 1;
});
