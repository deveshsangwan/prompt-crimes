import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Adapter, AdapterOptions, Message } from "./index";
import { openReadonlyDatabase, type SqliteDatabase } from "./sqlite";

export function opencodeAdapter(): Adapter {
  return {
    name: "opencode",
    async *messages(options?: AdapterOptions): AsyncGenerator<Message> {
      const dbPath = getOpencodeDatabasePath();
      if (!dbPath) return;

      const db = await openReadonlyDatabase(dbPath);
      if (!db) return;

      try {
        yield* queryUserMessages(db, options);
      } finally {
        db.close();
      }
    }
  };
}

function getOpencodeDatabasePath(): string | null {
  const xdgPath = join(
    process.env["XDG_DATA_HOME"] ?? join(homedir(), ".local", "share"),
    "opencode",
    "opencode.db"
  );
  if (existsSync(xdgPath)) return xdgPath;

  if (process.platform === "darwin") {
    const macPath = join(
      homedir(),
      "Library",
      "Application Support",
      "opencode",
      "opencode.db"
    );
    if (existsSync(macPath)) return macPath;
  }

  return null;
}

function* queryUserMessages(
  db: SqliteDatabase,
  options?: AdapterOptions
): Generator<Message> {
  let query = `
    SELECT
      m.session_id,
      m.time_created,
      json_extract(p.data, '$.text') as text
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE json_extract(m.data, '$.role') = 'user'
      AND json_extract(p.data, '$.type') = 'text'
  `;

  const params: unknown[] = [];
  if (options?.since) {
    query += " AND m.time_created >= ?";
    params.push(options.since.getTime());
  }

  query += " ORDER BY m.time_created ASC";

  const rows = db.prepare(query).all(...params) as {
    session_id: string;
    time_created: number;
    text: string;
  }[];

  for (const row of rows) {
    if (!row.text?.trim()) continue;
    yield {
      text: row.text,
      timestamp: new Date(row.time_created).toISOString(),
      session: row.session_id
    };
  }
}
