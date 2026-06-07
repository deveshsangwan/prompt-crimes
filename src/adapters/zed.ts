import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Adapter, AdapterOptions, Message } from "./index";
import { openReadonlyDatabase } from "./sqlite";

export function zedAdapter(): Adapter {
  return {
    name: "zed",
    async *messages(options?: AdapterOptions): AsyncGenerator<Message> {
      const paths = getZedPaths();
      yield* parseTextThreads(paths.conversations);
      yield* parseAgentThreads(paths.db, options);
    }
  };
}

function getZedPaths(): { conversations: string; db: string } {
  if (process.platform === "darwin") {
    const base = join(homedir(), "Library", "Application Support", "Zed");
    return { conversations: join(base, "conversations"), db: join(base, "db") };
  }
  const base = join(
    process.env["XDG_DATA_HOME"] ?? join(homedir(), ".local", "share"),
    "zed"
  );
  return { conversations: join(base, "conversations"), db: join(base, "db") };
}

async function* parseTextThreads(dir: string): AsyncGenerator<Message> {
  if (!existsSync(dir)) return;
  const files = await readdir(dir).catch(() => [] as string[]);

  for (const file of files.filter((entry) => entry.endsWith(".json"))) {
    try {
      const raw = await readFile(join(dir, file), "utf-8");
      const conversation = JSON.parse(raw) as ZedConversation;
      if (!Array.isArray(conversation.messages)) continue;

      for (const message of conversation.messages) {
        if (message.role !== "user" || typeof message.content !== "string") continue;
        yield { text: message.content, session: file.replace(".json", "") };
      }
    } catch {
      // Skip malformed conversation files.
    }
  }
}

async function* parseAgentThreads(
  dbDir: string,
  _options?: AdapterOptions
): AsyncGenerator<Message> {
  if (!existsSync(dbDir)) return;
  const dbFiles = (await readdir(dbDir).catch(() => [] as string[])).filter((file) =>
    file.endsWith(".db")
  );
  if (dbFiles.length === 0) return;

  for (const dbFile of dbFiles) {
    const db = await openReadonlyDatabase(join(dbDir, dbFile));
    if (!db) continue;

    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
        name: string;
      }[];
      const tableName = tables
        .map((table) => table.name)
        .find((name) => name === "messages" || name === "thread_messages" || name.includes("message"));
      if (!tableName) continue;

      const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as { name: string }[];
      const columnNames = columns.map((column) => column.name);
      if (!columnNames.includes("role")) continue;

      const contentColumn = columnNames.includes("content")
        ? "content"
        : columnNames.includes("body")
          ? "body"
          : "text";
      if (!columnNames.includes(contentColumn)) continue;

      const rows = db
        .prepare(`SELECT "${contentColumn}" as text FROM "${tableName}" WHERE role = 'user'`)
        .all() as { text: string }[];

      for (const row of rows) {
        if (row.text?.trim()) yield { text: row.text };
      }
    } catch {
      // Skip schema mismatches.
    } finally {
      db.close();
    }
  }
}

interface ZedConversation {
  messages?: { role?: string; content?: unknown }[];
}
