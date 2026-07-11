import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

// Safety net for a regression hit twice this session: prefs.ts runs in a
// separate, non-Shell GJS process with no St typelib. Rolldown's chunk
// splitting shares small leaf modules (e.g. the SpaceType enum) between
// extension.js and prefs.js, and depending on codeSplitting group order in
// vite.config.ts, that shared module can get bundled into a chunk that also
// imports "gi://St" — crashing the prefs window with "Typelib file for
// namespace 'St' ... not found" as soon as it loads. Catches that
// automatically instead of relying on manually keeping group order correct.
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
      const importedChunks = [...readChunk(name).matchAll(/from\s+"\.\/([\w-]+\.js)"/g)].map(
        (m) => m[1],
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
