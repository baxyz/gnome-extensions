import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { readTable } from "../src/helper/sqlite.helper";

function makeDb(setup: (db: DatabaseSync) => void): Uint8Array {
  const path = join(tmpdir(), `sqlite-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
  const db = new DatabaseSync(path);
  try {
    setup(db);
    db.close();
    return new Uint8Array(readFileSync(path));
  } finally {
    try { unlinkSync(path); } catch { /* ignore */ }
  }
}

describe("readTable", () => {
  it("returns empty array for unknown table", () => {
    const data = makeDb((db) => {
      db.exec("CREATE TABLE Foo (id INTEGER PRIMARY KEY, val TEXT)");
    });
    expect(readTable(data, "Bar")).toEqual([]);
  });

  it("reads rows with correct column names and values", () => {
    const data = makeDb((db) => {
      db.exec(`
        CREATE TABLE Profiles (
          id   INTEGER PRIMARY KEY,
          path TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL
        );
        INSERT INTO Profiles VALUES (1, 'Profiles/abc1.default-release', 'Default');
        INSERT INTO Profiles VALUES (2, 'c7IZaLu7.Perso', 'Perso');
        INSERT INTO Profiles VALUES (3, 'q9RtZpLw.Boulot', 'Boulot');
      `);
    });

    const rows = readTable(data, "Profiles");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ path: "Profiles/abc1.default-release", name: "Default" });
    expect(rows[1]).toMatchObject({ path: "c7IZaLu7.Perso", name: "Perso" });
    expect(rows[2]).toMatchObject({ path: "q9RtZpLw.Boulot", name: "Boulot" });
  });

  it("handles unicode profile names", () => {
    const data = makeDb((db) => {
      db.exec(`
        CREATE TABLE Profiles (id INTEGER PRIMARY KEY, path TEXT, name TEXT);
        INSERT INTO Profiles VALUES (1, 'abc.test', 'Profil Spécial émojis 🦊');
      `);
    });

    const rows = readTable(data, "Profiles");
    expect(rows[0]?.name).toBe("Profil Spécial émojis 🦊");
  });

  it("returns empty array on empty table", () => {
    const data = makeDb((db) => {
      db.exec("CREATE TABLE Profiles (id INTEGER PRIMARY KEY, path TEXT, name TEXT)");
    });
    expect(readTable(data, "Profiles")).toEqual([]);
  });

  it("throws on invalid magic bytes", () => {
    const bad = new Uint8Array(4096).fill(0);
    expect(() => readTable(bad, "Profiles")).toThrow("not a SQLite3 file");
  });
});
