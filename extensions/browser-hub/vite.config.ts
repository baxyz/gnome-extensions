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
        manualChunks: (id) => {
          if (id.includes("node_modules/mozlz4")) return "mozlz4";
          if (id.includes("node_modules/sqlite-reader")) return "sqlite-reader";
        },
        chunkFileNames: "[name].js",
      },
    },
  },
});
