import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Adapter, AdapterOptions, Message } from "./index";

const CODEX_SESSIONS_DIR = join(homedir(), ".codex", "sessions");

export function codexAdapter(): Adapter {
  return {
    name: "codex",
    async *messages(options?: AdapterOptions): AsyncGenerator<Message> {
      yield* walkCodexSessions(CODEX_SESSIONS_DIR, options);
    }
  };
}

async function* walkCodexSessions(dir: string, options?: AdapterOptions): AsyncGenerator<Message> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const entryStat = await stat(fullPath).catch(() => null);
    if (!entryStat) continue;

    if (entryStat.isDirectory()) {
      yield* walkCodexSessions(fullPath, options);
    } else if (entry.endsWith(".jsonl")) {
      yield* parseCodexJsonl(fullPath, {
        session: entry.replace(".jsonl", ""),
        since: options?.since
      });
    }
  }
}

export async function* parseCodexJsonl(
  filePath: string,
  context: { session: string; since?: Date }
): AsyncGenerator<Message> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as CodexEntry;
      if (entry.type !== "response_item") continue;
      if (!entry.payload || entry.payload.role !== "user") continue;

      const text = extractText(entry.payload.content);
      if (!text) continue;
      if (text.startsWith("<environment_context>")) continue;
      if (text.startsWith("<permissions instructions>")) continue;

      if (context.since && entry.timestamp) {
        const timestamp = new Date(entry.timestamp);
        if (timestamp < context.since) continue;
      }

      yield {
        text,
        timestamp: entry.timestamp,
        session: context.session
      };
    } catch {
      // Skip malformed JSONL rows.
    }
  }
}

function extractText(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const parts = content
    .filter(
      (part): part is { type: string; text: string } =>
        typeof part === "object" &&
        part !== null &&
        part.type === "input_text" &&
        typeof part.text === "string"
    )
    .map((part) => part.text);

  return parts.length > 0 ? parts.join(" ") : null;
}

interface CodexEntry {
  timestamp?: string;
  type: string;
  payload?: {
    role?: string;
    content?: unknown;
  };
}
