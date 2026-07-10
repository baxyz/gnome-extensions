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
        // icons/ — back into their sole importer, with no override
        // available; declarative groups with a `test` pattern each (rolldown's
        // native codeSplitting API) don't have that problem and is what
        // rolldown recommends going forward anyway.
        codeSplitting: {
          minSize: 0,
          groups: [
            { name: "icons", test: /\/icons\// },
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
