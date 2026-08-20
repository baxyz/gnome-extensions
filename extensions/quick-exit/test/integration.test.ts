import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";
import metadata from "../metadata.json";
import tsconfig from "../tsconfig.json";

describe("Quick Exit Extension Integration", () => {
  it("should handle multiple GNOME Shell versions", () => {
    const versions = metadata["shell-version"];

    versions.forEach((version) => {
      expect(version).toMatch(/^(4[6-9]|50)$/);
    });
  });

  it("should compile successfully with all GNOME Shell versions", { timeout: 20000 }, () => {
    const versions = metadata["shell-version"];

    versions.forEach((version) => {
      const cwd = process.cwd();
      const tempConfigPath = resolve(cwd, `.tsconfig.test-${version}.json`);

      const tempConfig = {
        ...tsconfig,
        compilerOptions: {
          ...tsconfig.compilerOptions,
          noEmit: true,
          skipLibCheck: true,
          paths: {
            ...tsconfig.compilerOptions.paths,
            // A bare-specifier entry alone doesn't match this extension's
            // actual imports (src/ambient.d.ts pulls "@girs/gnome-shell/ambient"
            // and "@girs/gnome-shell/extensions/global"), so those fall through
            // to plain node_modules resolution and silently type-check against
            // the default v50 package on every iteration, regardless of
            // `version`. A wildcard ("@girs/gnome-shell/*") doesn't fix this
            // either — @girs/gnome-shell's package.json remaps each subpath
            // through "exports" (e.g. "./ambient" -> "./dist/index-ambient.d.ts"),
            // which `paths` substitution doesn't follow; verified via
            // `tsc --traceResolution` that a wildcard still lands on v50's
            // dist file. The two subpaths actually used have to be mapped to
            // their real dist targets explicitly instead.
            "@girs/gnome-shell": [`./node_modules/@girs/gnome-shell-${version}`],
            "@girs/gnome-shell/ambient": [
              `./node_modules/@girs/gnome-shell-${version}/dist/index-ambient.d.ts`,
            ],
            "@girs/gnome-shell/extensions/global": [
              `./node_modules/@girs/gnome-shell-${version}/dist/extensions/global.d.ts`,
            ],
          },
        },
      };

      const tscBin = resolve(cwd, "node_modules/.bin/tsc");
      try {
        writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2));
        execFileSync(tscBin, ["--project", tempConfigPath], {
          cwd,
          encoding: "utf-8",
        });
      } catch (error: any) {
        throw new Error(
          `TypeScript compilation failed for GNOME Shell ${version}:\n${error.stdout || error.message}`,
        );
      } finally {
        try {
          unlinkSync(tempConfigPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });
});
