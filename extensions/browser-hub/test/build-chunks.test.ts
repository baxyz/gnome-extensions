import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve, posix } from "path";

// Safety net for a regression hit twice this session: prefs.ts runs in a
// separate, non-Shell GJS process with no St typelib. The build output now
// mirrors src/'s own directory layout one file per module (preserveModules
// in vite.config.ts, done for EGO review — dist/ reads file-for-file against
// the source), and a small leaf module (e.g. the SpaceType enum) can be
// imported by both extension.js and prefs.js — nothing stops it, or a chunk
// it itself imports, from also pulling in "gi://St" and crashing the prefs
// window with "Typelib file for namespace 'St' ... not found" as soon as it
// loads. Catches that automatically instead of relying on manually auditing
// every module prefs.js can reach.
describe("build output chunk isolation", () => {
  it("never lets dist/prefs.js's dependency graph import gi://St", { timeout: 20000 }, () => {
    const cwd = process.cwd();
    const vitePath = resolve(cwd, "node_modules/.bin/vite");
    execSync(`"${vitePath}" build`, { cwd, encoding: "utf-8" });

    const distDir = resolve(cwd, "dist");
    const readChunk = (name: string): string => readFileSync(resolve(distDir, name), "utf-8");

    const visited = new Set<string>();
    const toVisit = ["prefs.js"];
    while (toVisit.length > 0) {
      const name = toVisit.pop();
      if (name === undefined || visited.has(name)) continue;
      visited.add(name);
      // Imports are now relative paths that can cross directories (e.g.
      // "../taxonomy/space-type.enum.js"), not just flat "./name.js" —
      // resolve each against the importing chunk's own directory.
      const importedChunks = [...readChunk(name).matchAll(/from\s+"(\.\.?\/[^"]+\.js)"/g)].map(
        (m) => posix.normalize(posix.join(posix.dirname(name), m[1])),
      );
      toVisit.push(...importedChunks);
    }

    expect(visited.size).toBeGreaterThan(0); // sanity check the graph walk actually found something
    for (const name of visited) {
      expect(
        readChunk(name),
        `${name} (in prefs.js's dependency graph) must not import gi://St`,
      ).not.toContain("gi://St");
    }
  });
});
