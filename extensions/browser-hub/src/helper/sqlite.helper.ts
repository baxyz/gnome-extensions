// Read-only SQLite3 binary parser — leaf + interior B-tree pages, no overflow, UTF-8 only.
// Spec: https://www.sqlite.org/fileformat2.html

type SqliteValue = string | number | null;
export type SqliteRow = Record<string, SqliteValue>;

function u16(buf: Uint8Array, off: number): number {
  return (buf[off] << 8) | buf[off + 1];
}

function u32(buf: Uint8Array, off: number): number {
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

function varint(buf: Uint8Array, pos: number): [value: number, size: number] {
  let v = 0;
  for (let i = 0; i < 8; i++) {
    const b = buf[pos + i];
    v = (v << 7) | (b & 0x7f);
    if (!(b & 0x80)) return [v, i + 1];
  }
  return [v * 256 + buf[pos + 8], 9];
}

function decodeRecord(payload: Uint8Array): SqliteValue[] {
  let pos = 0;
  const [hdrEnd, hs] = varint(payload, pos);
  pos += hs;

  const types: number[] = [];
  while (pos < hdrEnd) {
    const [t, ts] = varint(payload, pos);
    pos += ts;
    types.push(t);
  }

  pos = hdrEnd;
  const values: SqliteValue[] = [];
  const dec = new TextDecoder();

  for (const t of types) {
    if (t === 0) {
      values.push(null);
    } else if (t === 1) {
      const v = payload[pos++];
      values.push(v >= 0x80 ? v - 0x100 : v);
    } else if (t === 2) {
      const v = u16(payload, pos); pos += 2;
      values.push(v >= 0x8000 ? v - 0x10000 : v);
    } else if (t === 3) {
      const v = (payload[pos] << 16) | (payload[pos + 1] << 8) | payload[pos + 2]; pos += 3;
      values.push(v >= 0x800000 ? v - 0x1000000 : v);
    } else if (t === 4) {
      const v = u32(payload, pos); pos += 4;
      values.push(v >= 0x80000000 ? v - 0x100000000 : v);
    } else if (t === 5) {
      pos += 6; values.push(null);
    } else if (t === 6) {
      pos += 8; values.push(null);
    } else if (t === 7) {
      pos += 8; values.push(null);
    } else if (t === 8) {
      values.push(0);
    } else if (t === 9) {
      values.push(1);
    } else if (t >= 12 && t % 2 === 0) {
      pos += (t - 12) / 2; values.push(null); // blob — skip
    } else if (t >= 13 && t % 2 === 1) {
      const len = (t - 13) / 2;
      values.push(dec.decode(payload.subarray(pos, pos + len)));
      pos += len;
    } else {
      values.push(null);
    }
  }

  return values;
}

function traverseTable(db: Uint8Array, pageNum: number, pageSize: number): SqliteValue[][] {
  const base = (pageNum - 1) * pageSize;
  const hdr = pageNum === 1 ? 100 : 0; // page 1 has 100-byte db header before the btree header

  const pageType = db[base + hdr];
  const numCells = u16(db, base + hdr + 3);
  const rows: SqliteValue[][] = [];

  if (pageType === 13) {
    // Leaf table page
    const ptrBase = base + hdr + 8;
    for (let i = 0; i < numCells; i++) {
      let pos = base + u16(db, ptrBase + i * 2);
      const [payloadLen, ps] = varint(db, pos); pos += ps;
      const [, rs] = varint(db, pos); pos += rs; // skip rowid
      rows.push(decodeRecord(db.subarray(pos, pos + payloadLen)));
    }
  } else if (pageType === 5) {
    // Interior table page
    const rightmost = u32(db, base + hdr + 8);
    const ptrBase = base + hdr + 12;
    for (let i = 0; i < numCells; i++) {
      const cellPos = base + u16(db, ptrBase + i * 2);
      rows.push(...traverseTable(db, u32(db, cellPos), pageSize));
    }
    rows.push(...traverseTable(db, rightmost, pageSize));
  }

  return rows;
}

function parseColumnNames(sql: string): string[] {
  const start = sql.indexOf("(");
  const end = sql.lastIndexOf(")");
  if (start === -1 || end === -1) return [];

  // Split by top-level commas (skip nested parentheses)
  const defs: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of sql.slice(start + 1, end)) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      defs.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) defs.push(cur.trim());

  return defs
    .map((def) => def.match(/^["'`]?(\w+)["'`]?/)?.[1] ?? "")
    .filter((name) => name && !/^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)/i.test(name));
}

const MAGIC = "SQLite format 3\0";

export function readTable(db: Uint8Array, tableName: string): SqliteRow[] {
  for (let i = 0; i < 16; i++) {
    if (db[i] !== MAGIC.charCodeAt(i)) throw new Error("not a SQLite3 file");
  }

  let pageSize = u16(db, 16);
  if (pageSize === 1) pageSize = 65536;

  // sqlite_master is always at root page 1; columns: type, name, tbl_name, rootpage, sql
  const master = traverseTable(db, 1, pageSize);

  let rootPage: number | null = null;
  let columnSql: string | null = null;

  for (const row of master) {
    if (row[0] === "table" && row[1] === tableName) {
      rootPage = typeof row[3] === "number" ? row[3] : null;
      columnSql = typeof row[4] === "string" ? row[4] : null;
      break;
    }
  }

  if (rootPage === null) return [];

  const columns = columnSql ? parseColumnNames(columnSql) : [];
  return traverseTable(db, rootPage, pageSize).map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i] ?? null])),
  );
}
