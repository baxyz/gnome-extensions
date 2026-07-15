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

const base = createViteConfig();

export default defineConfig({
  ...base,
  plugins: [...(base.plugins as Plugin[]), gnomeSchemas()],
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
        // getting its own. Both taxonomy and icons are dependencies of
        // browser (firefox.ts imports both), so they must precede it.
        // taxonomy (src/taxonomy/ — its runtime content is just the
        // BrowserType/PackageManager/SpaceType enums, the rest fully erases
        // at compile time) must also precede everything else: prefs.ts (a
        // separate, non-Shell GJS process without the St typelib) imports
        // one of those enums too — swallowed into any chunk that also
        // imports "gi://St" (e.g. icons), loading prefs.js would crash it.
        codeSplitting: {
          minSize: 0,
          groups: [
            { name: "taxonomy", test: /\/taxonomy\// },
            { name: "icons", test: /\/icons\// },
            { name: "vendor-helpers4", test: /@helpers4/ },
            { name: "vendor-mozlz4", test: /node_modules\/mozlz4/ },
            { name: "vendor-sqlite-reader", test: /node_modules\/sqlite-reader/ },
            { name: "browser", test: /\/browser\// },
            { name: "internal", test: /\/internal\// },
          ],
        },
        chunkFileNames: "[name].js",
      },
    },
  },
});
