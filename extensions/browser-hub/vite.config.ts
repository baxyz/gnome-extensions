import { cpSync, existsSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { createViteConfig } from "../../tooling/vite.config.base.ts";

function gnomeSchemas(): Plugin {
  return {
    name: "gnome-schemas",
    apply: "build",
    closeBundle() {
      if (existsSync("schemas")) cpSync("schemas", "dist/schemas", { recursive: true });
    },
  };
}

const base = createViteConfig();

export default defineConfig({
  ...base,
  plugins: [...(Array.isArray(base.plugins) ? base.plugins : []), gnomeSchemas()],
  build: {
    ...base.build,
    lib: {
      entry: {
        extension: "src/extension.ts",
        prefs: "src/prefs.ts",
      },
      formats: ["es"],
      fileName: (_: string, entryName: string) => `${entryName}.js`,
    },
  },
});
