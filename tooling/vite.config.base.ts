import { cpSync, existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { defineConfig, type Plugin, type UserConfig } from "vite";

function gnomeAssets(uuid: string): Plugin {
  return {
    name: "gnome-assets",
    apply: "build",
    closeBundle() {
      cpSync("metadata.json", "dist/metadata.json");
      if (existsSync("src/stylesheet.css")) {
        cpSync("src/stylesheet.css", "dist/stylesheet.css");
      }

      if (!this.meta.watchMode) return;

      const dest = `${process.env.HOME}/.local/share/gnome-shell/extensions/${uuid}`;
      mkdirSync(`${process.env.HOME}/.local/share/gnome-shell/extensions`, { recursive: true });
      if (existsSync(dest)) rmSync(dest, { recursive: true });
      cpSync("dist", dest, { recursive: true });
      console.log(`\n[gnome] installed → ${dest}`);

      try {
        execSync(`gnome-extensions disable ${uuid} && gnome-extensions enable ${uuid}`, { stdio: "ignore" });
        console.log(`[gnome] reloaded ${uuid}`);
      } catch {
        console.log(`[gnome] reload: gnome-extensions disable ${uuid} && gnome-extensions enable ${uuid}`);
      }
    },
  };
}

export function createViteConfig(): UserConfig {
  const metadata = JSON.parse(readFileSync("./metadata.json", "utf-8"));
  return defineConfig({
    plugins: [gnomeAssets(metadata.uuid)],
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
