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
        // This build runs on rolldown (Vite 8's default bundler), not classic
        // Rollup. Its manualChunks compat shim (a single function deciding
        // every module's group) silently merged small groups — including
        // helper/icons/ — back into their sole importer, with no override
        // available; declarative groups with a `test` pattern each (rolldown's
        // native codeSplitting API) don't have that problem and is what
        // rolldown recommends going forward anyway.
        // Group order is priority order (earlier = higher priority — see
        // rolldown's codeSplitting docs) and it's load-bearing here:
        // helper/icons/ is a dependency of files matched by helper-browser
        // (firefox.ts imports it), and with helper-browser listed first,
        // rolldown's recursive dependency inclusion silently swallowed
        // helper/icons/ into helper-browser.js before helper-icons' own
        // `test` got a chance to claim it. Keep any group whose files are
        // *imported by* another group's files listed above that group.
        codeSplitting: {
          minSize: 0,
          groups: [
            { name: "helper-icons", test: /\/helper\/icons\// },
            { name: "vendor-mozlz4", test: /node_modules\/mozlz4/ },
            { name: "vendor-sqlite-reader", test: /node_modules\/sqlite-reader/ },
            { name: "vendor-helpers4", test: /@helpers4/ },
            { name: "helper-browser", test: /\/helper\/browser\// },
            { name: "helper-internal", test: /\/helper\/internal\// },
          ],
        },
        chunkFileNames: "[name].js",
      },
    },
  },
});
