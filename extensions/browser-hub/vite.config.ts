import { cpSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";
import { createViteConfig } from "../../tooling/vite-config.helper.ts";

function gnomeSchemas(): Plugin {
  return {
    name: "gnome-schemas",
    apply: "build",
    closeBundle() {
      if (existsSync("schemas")) {
        cpSync("schemas", "dist/schemas", { recursive: true });
        execSync("glib-compile-schemas dist/schemas/");
      }
    },
  };
}

// Static assets (currently just the package-manager badge SVGs) aren't
// imported by any TS module — Gio.FileIcon loads them by path at runtime
// (see internal/desktop-icon.ts) — so they need copying into dist/ verbatim,
// the same way schemas/ does above.
function staticAssets(): Plugin {
  return {
    name: "static-assets",
    apply: "build",
    closeBundle() {
      if (existsSync("assets")) {
        cpSync("assets", "dist/assets", { recursive: true });
      }
    },
  };
}

const base = createViteConfig();

export default defineConfig({
  ...base,
  plugins: [...(base.plugins as Plugin[]), gnomeSchemas(), staticAssets()],
  build: {
    ...base.build,
    lib: {
      entry: {
        extension: "src/extension.ts",
        prefs: "src/prefs.ts",
      },
      formats: ["es"],
      fileName: (_, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      ...base.build?.rollupOptions,
      output: {
        ...base.build?.rollupOptions?.output,
        // GNOME extension submissions (EGO) are reviewed as the built dist/
        // output, not the TypeScript source — rolldown's default cross-chunk
        // export linking renames every export to a single letter (`export {
        // resolveZenIcon as r }`) purely to shave bytes off inter-chunk glue,
        // even with minify:false. Keep those names readable for review.
        minifyInternalExports: false,
        // This build runs on rolldown (Vite 8's default bundler), not classic
        // Rollup — its native codeSplitting API, not the manualChunks compat
        // shim (which silently merges small groups back into their sole
        // importer with no override available).
        //
        // Group order is priority order (earlier = higher priority): a
        // module used by files in two groups is claimed by whichever group
        // is listed first, so a group whose files are *imported by* another
        // group's files must be listed above that group — otherwise it gets
        // swallowed whole into the importing group's chunk instead of
        // getting its own. Below is the real dependency order (verified via
        // each file's own imports, `import type` doesn't count — those erase
        // at compile time and create no runtime edge):
        //   taxonomy, icons  →  paths  →  constants-<family>  →  internal
        //     →  browser-<family>  →  browser  →  default-browser
        //     →  donut-browser  →  (extension itself absorbs menu/indicator)
        // taxonomy (src/taxonomy/ — its runtime content is just the
        // BrowserType/PackageManager/SpaceType enums, the rest fully erases
        // at compile time) must precede everything else: prefs.ts (a
        // separate, non-Shell GJS process without the St typelib) imports
        // one of those enums too — swallowed into any chunk that also
        // imports "gi://St" (e.g. icons), loading prefs.js would crash it.
        // (build-chunks.test.ts guards against that regression directly.)
        //
        // Grouped by review-relevant theme, not just 1:1 with source
        // directories — this is EGO (extensions.gnome.org) review
        // territory: reviewers read the built dist/ output, not the
        // TypeScript source.
        // - constants/ and browser/ each split further, by browser family:
        //   "does this extension's Chromium-family code do anything
        //   untoward with Local State" is a standalone review question, and
        //   constants-chromium.js/browser-chromium.js answer it without also
        //   pulling in Firefox/Falkon/Simple definitions. firefox absorbs
        //   firefox-spaces.ts and zen.ts too — Zen is Firefox-derived and
        //   both are exclusively consumed by browser/firefox.ts, never by
        //   resolve-all.ts directly. paths.constant.ts is the one file under
        //   constants/ that ISN'T family data (just GLib home/XDG/snap-dir
        //   helpers every family other than Simple calls into) so it gets
        //   its own tiny shared chunk instead of arbitrarily picking one
        //   family to bundle it with.
        // - taxonomy is deliberately NOT split further despite being the
        //   same shape of ask: its entire runtime content is 3 short enums
        //   (~20 lines total, see dist/taxonomy.js) — splitting that into
        //   per-family fragments would be strictly worse to review (more
        //   files, less content in each) with no isolation benefit, unlike
        //   constants/browser where each family is hundreds of lines.
        // - menu/ and indicator.ts get no group of their own anymore: both
        //   are pure GNOME Shell UI glue (build the popup menu, wire click
        //   handlers) reachable only from extension.ts, so they fall
        //   through into extension.js instead of adding two more files for
        //   what reads as one "this is the panel button and its menu"
        //   concern — extension.js was already the smallest, simplest
        //   chunk, so absorbing them keeps it that way rather than
        //   fragmenting UI wiring across three files.
        // - default-browser.ts and donut-browser.ts keep their own chunks
        //   regardless: both are where this extension actually *does*
        //   something to the system (change the OS default browser, spawn
        //   a subprocess, write profile files) — the two places a reviewer
        //   most wants to isolate and read start-to-finish on their own.
        //
        // The vendor-* groups stay directly after taxonomy/icons (their
        // original position) rather than moving down with the first-party
        // groups below: this same priority rule applies across the
        // node_modules boundary too, not just between our own src/ groups —
        // a vendor-helpers4-matching module reachable only from `internal`
        // would otherwise get pulled *into* internal.js instead of staying
        // consolidated in the dedicated vendor-helpers4.js chunk.
        codeSplitting: {
          minSize: 0,
          groups: [
            { name: "taxonomy", test: /\/taxonomy\// },
            { name: "icons", test: /\/icons\// },
            { name: "vendor-helpers4", test: /@helpers4/ },
            { name: "vendor-mozlz4", test: /node_modules\/mozlz4/ },
            { name: "vendor-sqlite-reader", test: /node_modules\/sqlite-reader/ },
            { name: "paths", test: /\/constants\/paths\.constant\.ts$/ },
            { name: "constants-chromium", test: /\/constants\/chromium-browsers\.constant\.ts$/ },
            { name: "constants-falkon", test: /\/constants\/falkon-browsers\.constant\.ts$/ },
            { name: "constants-firefox", test: /\/constants\/firefox-browsers\.constant\.ts$/ },
            { name: "constants-simple", test: /\/constants\/simple-browsers\.constant\.ts$/ },
            { name: "internal", test: /\/internal\// },
            { name: "browser-chromium", test: /\/browser\/chromium/ },
            { name: "browser-falkon", test: /\/browser\/falkon/ },
            { name: "browser-firefox", test: /\/browser\/(firefox|zen)/ },
            { name: "browser", test: /\/browser\// },
            { name: "default-browser", test: /\/default-browser\.ts$/ },
            { name: "donut-browser", test: /\/donut-browser\.ts$/ },
          ],
        },
        chunkFileNames: "[name].js",
      },
    },
  },
});
