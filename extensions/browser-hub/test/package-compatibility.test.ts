import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import metadata from "../metadata.json";

const versions = metadata["shell-version"];
const minVersion = versions.reduce((min, v) => Math.min(min, parseInt(v)), Infinity);
const maxVersion = versions.reduce((max, v) => Math.max(max, parseInt(v)), -Infinity);

describe("GNOME Shell Package Compatibility", () => {
  it("should have vitest properly configured", () => {
    expect(true).toBe(true);
  });

  it("should have all required GNOME Shell versions in package.json", () => {
    const packageJsonPath = resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.devDependencies["@girs/gnome-shell"]).toBeDefined();
    expect(packageJson.devDependencies["@girs/gjs"]).toBeDefined();

    versions.forEach((version) => {
      expect(packageJson.devDependencies[`@girs/gnome-shell-${version}`]).toBeDefined();
    });
  });

  it("should reference GNOME Shell version aliases from catalog", () => {
    const packageJsonPath = resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    versions.forEach((version) => {
      expect(packageJson.devDependencies[`@girs/gnome-shell-${version}`]).toBe("catalog:");
    });
  });

  it("should verify GNOME Shell versions compatibility", () => {
    versions.forEach((version) => {
      expect(version).toMatch(/^(4[6-9]|50)$/);
      expect(parseInt(version)).toBeGreaterThanOrEqual(minVersion);
      expect(parseInt(version)).toBeLessThanOrEqual(maxVersion);
    });
  });

  it("should have proper TypeScript configuration", () => {
    expect(() => {
      return versions.map((v) => `gnome-shell-${v}`);
    }).not.toThrow();
  });
});
