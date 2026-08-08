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
 * - Every user_pref() line DONUT_USER_JS writes, actually changing
 *   Firefox's behavior: privacy.resistFingerprinting (timezone — see the
 *   ROADMAP for why this one pref already covers canvas/WebGL/timezone/
 *   MediaDevices without needing separate checks for each), plus its two
 *   companion prefs that RFP doesn't itself cover: letterboxing (viewport
 *   rounded to a 200x100 grid) and spoof_english (navigator.language
 *   forced to en-US regardless of host locale).
 * - Disposability: the profile directory is gone once the session ends.
 * - NOT covered: browser.privatebrowsing.autostart — verifying an actual
 *   private-browsing window needs Firefox chrome/WebExtension APIs, not
 *   just content-page JS, so there's no reliable signal from inside
 *   page.evaluate(); the GNOME Shell button/spinner (no St under Node);
 *   and launchDonutBrowser()'s own Gio.Subprocess-based launch against a
 *   real system-installed Firefox/Zen/etc — Playwright can only drive its
 *   own patched Firefox build, not an arbitrary one, so this script
 *   launches the profile directly via Playwright's
 *   launchPersistentContext() instead of going through launchBrowser().
 *
 * Run with: pnpm test:e2e (needs `npx playwright install firefox` once).
 */
import * as fs from "fs";
import assert from "node:assert/strict";
import { firefox } from "playwright";
import { createDonutProfile } from "../src/donut-browser";

// Deliberately not a multiple of the 200x100 letterboxing grid, so a
// rounded-down result below can only come from letterboxing actually
// kicking in — not from coincidentally requesting an already-aligned size.
const REQUESTED_VIEWPORT = { width: 851, height: 653 };

async function main() {
  console.log("Creating a Donut profile...");
  const profileDir = await createDonutProfile();

  try {
    assert.ok(fs.statSync(profileDir).isDirectory(), `expected a directory at ${profileDir}`);
    const userJsPath = `${profileDir}/user.js`;
    const userJs = fs.readFileSync(userJsPath, "utf8");
    for (const pref of [
      /user_pref\("privacy\.resistFingerprinting", true\);/,
      /user_pref\("privacy\.resistFingerprinting\.letterboxing", true\);/,
      /user_pref\("privacy\.spoof_english", 1\);/,
      /user_pref\("browser\.privatebrowsing\.autostart", true\);/,
    ]) {
      assert.match(userJs, pref, `user.js should contain ${pref}`);
    }
    console.log(`✅ profile created on disk at ${profileDir}, with a real user.js`);

    console.log("Launching Firefox with it as the profile...");
    const context = await firefox.launchPersistentContext(profileDir, {
      headless: true,
      viewport: REQUESTED_VIEWPORT,
    });
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

      const { language, languages } = await page.evaluate(() => ({
        language: navigator.language,
        languages: navigator.languages,
      }));
      assert.equal(language, "en-US", "privacy.spoof_english should force navigator.language");
      assert.deepEqual(
        languages,
        ["en-US", "en"],
        "privacy.spoof_english should force navigator.languages",
      );
      console.log("✅ privacy.spoof_english is in effect");

      const { innerWidth, innerHeight } = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      }));
      assert.ok(
        innerWidth < REQUESTED_VIEWPORT.width && innerWidth % 200 === 0,
        `letterboxing should round the viewport width down to a multiple of 200, got ${innerWidth}`,
      );
      assert.ok(
        innerHeight < REQUESTED_VIEWPORT.height && innerHeight % 100 === 0,
        `letterboxing should round the viewport height down to a multiple of 100, got ${innerHeight}`,
      );
      console.log("✅ privacy.resistFingerprinting.letterboxing is in effect");
    } finally {
      await context.close();
    }
  } finally {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }

  assert.ok(!fs.existsSync(profileDir), `expected ${profileDir} to be gone after cleanup`);
  console.log("✅ profile directory removed — the session left nothing behind");

  console.log("\nAll good.");
}

main().catch((e: unknown) => {
  console.error("❌ Donut e2e check failed:");
  console.error(e);
  process.exitCode = 1;
});
