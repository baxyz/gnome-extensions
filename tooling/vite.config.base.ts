import { readFileSync } from "node:fs";
import { defineConfig, type UserConfig } from "vite";

export function createViteConfig(): UserConfig {
  const metadata = JSON.parse(readFileSync("./metadata.json", "utf-8"));
  return defineConfig({
    build: {
      lib: {
        entry: "src/extension.ts",
        formats: ["es"],
        fileName: () => "extension.js",
      },
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      minify: false,
      rollupOptions: {
        external: [/^gi:\/\/.*/, /^resource:\/\/.*/],
        output: {
          banner: `// NAME: ${metadata.name}\n// VERSION: ${metadata["shell-version"].join(", ")}\n`,
        },
      },
    },
    esbuild: {
      target: "es2022",
    },
  });
}
