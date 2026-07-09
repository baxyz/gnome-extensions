import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ENTRY_AFFECTING_KEYS, COSMETIC_KEYS } from "../src/settings-keys";

function schemaKeys(): string[] {
  const xml = readFileSync(
    resolve(process.cwd(), "schemas/org.gnome.shell.extensions.browser-hub.gschema.xml"),
    "utf-8",
  );
  return [...xml.matchAll(/<key name="([^"]+)"/g)].map((m) => m[1]);
}

describe("settings key classification", () => {
  it("classifies every gschema key as either entry-affecting or cosmetic", () => {
    const unclassified = schemaKeys().filter(
      (key) => !ENTRY_AFFECTING_KEYS.has(key) && !COSMETIC_KEYS.has(key),
    );
    expect(unclassified).toEqual([]);
  });

  it("doesn't classify a key that no longer exists in the gschema", () => {
    const keys = new Set(schemaKeys());
    const stale = [...ENTRY_AFFECTING_KEYS, ...COSMETIC_KEYS].filter((key) => !keys.has(key));
    expect(stale).toEqual([]);
  });
});
