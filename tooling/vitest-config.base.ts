import { defineConfig, type UserConfig } from "vitest/config";

export function createVitestConfig(): UserConfig {
  return defineConfig({
    test: {
      globals: true,
      environment: "node",
      include: ["test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
      exclude: ["node_modules", "dist", ".git", ".cache"],
    },
    server: {
      port: 51204,
    },
  });
}
