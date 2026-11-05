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

// A dependency's module ids are pnpm store paths (e.g. "node_modules/.pnpm/
// @helpers4+object@3.1.11/node_modules/@helpers4/object/lib/safeJsonParse.js").
// Map every module of a package to one "vendor-<package>" chunk, taken from the
// last "node_modules/" segment so no store path leaks into dist/.
function vendorChunkName(id: string): string | null {
  const segments = id.split("node_modules/");
  if (segments.length < 2) return null;
  const pkg = segments[segments.length - 1].match(/^(@[^/]+\/[^/]+|[^/]+)/)?.[1];
  return pkg ? `vendor-${pkg.replace(/^@/, "").replace(/\//g, "-")}` : null;
}

// One chunk per src/ module, at its path under src/ (dist/browser/firefox.js
// for src/browser/firefox.ts). Entries are left out: they keep their own file.
function srcChunkName(id: string): string | null {
  if (/\/src\/(extension|prefs)\.ts$/.test(id)) return null;
  return id.match(/\/src\/(.+)\.ts$/)?.[1] ?? null;
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
      // Required by includeDependenciesRecursively: false (Vite's lib mode
      // defaults to "strict"). Entry exports are kept as they are.
      preserveEntrySignatures: "allow-extension",
      output: {
        ...base.build?.rollupOptions?.output,
        // EGO reviewers read dist/, not the TypeScript source: keep export
        // names readable instead of single letters (`export { x as r }`).
        minifyInternalExports: false,
        // EGO reviewers compare dist/ with src/ file by file (v1 review).
        // preserveModules would do it too, but it also splits a dependency
        // into one file per module (helpers4 ships one file per helper since
        // 3.1.11), so modules are grouped by name instead: src/ modules one
        // per file, each dependency in a single vendor-<package>.js.
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              debugName: "src-and-vendor",
              name: (id: string) => vendorChunkName(id) ?? srcChunkName(id),
            },
          ],
        },
        chunkFileNames: "[name].js",
      },
    },
  },
});
