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

// preserveModules names a chunk after its module's path relative to
// preserveModulesRoot — for our own src/ files that's already the clean
// mirrored path we want (e.g. "browser/firefox"), but for a dependency
// under node_modules it's the full on-disk path including pnpm's nested
// store layout (e.g. "node_modules/.pnpm/@helpers4+object@3.0.7/node_modules
// /@helpers4/object/lib/index") — collapse those down to a short, stable
// "vendor-<package>" name instead of leaking pnpm's store structure into the
// reviewed output. Derived structurally from the *last* "node_modules/"
// segment (pnpm's own .pnpm/<encoded>/ nesting always has one more
// "node_modules/" before the real package) rather than a hand-maintained
// per-dependency list — the previous version of this function needed a new
// regex/branch added every time a new runtime dependency showed up, quietly
// falling back to the raw pnpm-store path (leaking it into dist/) for any
// dependency someone forgot to add.
function vendorChunkName(name: string): string | null {
  const segments = name.split("node_modules/");
  if (segments.length < 2) return null;
  const pkg = segments[segments.length - 1].match(/^(@[^/]+\/[^/]+|[^/]+)/)?.[1];
  return pkg ? `vendor-${pkg.replace(/^@/, "").replace(/\//g, "-")}` : null;
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
        // One output file per source module, mirroring src/'s own directory
        // layout under dist/ exactly (preserveModulesRoot strips the "src/"
        // prefix so dist/browser/firefox.js, not dist/src/browser/firefox.js).
        // A prior version of this config hand-grouped modules into ~20
        // themed chunks via codeSplitting — EGO review feedback on the v1
        // submission was that reviewers read dist/ file-for-file against the
        // source and want that mapping literal, not thematically regrouped,
        // so this is preserveModules doing that mapping structurally instead
        // of via a hand-maintained (and easily stale) list of regexes.
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: (chunkInfo) => `${vendorChunkName(chunkInfo.name) ?? chunkInfo.name}.js`,
      },
    },
  },
});
