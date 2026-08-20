import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import metadata from "../metadata.json";

const versions = metadata["shell-version"];

describe("GNOME Shell Package Compatibility", () => {
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

  it("should list supported GNOME Shell versions in ascending order", () => {
    versions.forEach((version) => {
      expect(version).toMatch(/^(4[6-9]|50)$/);
    });
    const numeric = versions.map((v) => parseInt(v));
    expect(numeric).toEqual([...numeric].sort((a, b) => a - b));
  });
});
