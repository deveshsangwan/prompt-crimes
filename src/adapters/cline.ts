import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Adapter, AdapterOptions, Message } from "./index";

export function clineAdapter(): Adapter {
  return {
    name: "cline",
    async *messages(options?: AdapterOptions): AsyncGenerator<Message> {
      for (const tasksDir of getClineTaskDirs()) {
        const taskIds = await readdir(tasksDir).catch(() => [] as string[]);

        for (const taskId of taskIds) {
          const taskDir = join(tasksDir, taskId);
          const taskStat = await stat(taskDir).catch(() => null);
          if (!taskStat?.isDirectory()) continue;

          try {
            const raw = await readFile(join(taskDir, "api_conversation_history.json"), "utf-8");
            const messages = JSON.parse(raw) as ClineMessage[];
            if (!Array.isArray(messages)) continue;

            for (const message of messages) {
              if (message.role !== "user") continue;
              const text = extractText(message.content);
              if (!text) continue;

              const timestamp = message.ts ?? undefined;
              if (options?.since && timestamp) {
                const ts = new Date(timestamp);
                if (ts < options.since) continue;
              }

              yield { text, timestamp, session: taskId };
            }
          } catch {
            // Skip missing or malformed history files.
          }
        }
      }
    }
  };
}

function getClineTaskDirs(): string[] {
  const dirs: string[] = [];
  const extensionIds = ["saoudrizwan.claude-dev", "rooveterinaryinc.roo-cline"];

  for (const basePath of getVSCodeGlobalStoragePaths()) {
    for (const extensionId of extensionIds) {
      const tasksDir = join(basePath, extensionId, "tasks");
      if (existsSync(tasksDir)) dirs.push(tasksDir);
    }
  }

  const standalone = join(homedir(), ".cline", "data", "tasks");
  if (existsSync(standalone)) dirs.push(standalone);
  return dirs;
}

function getVSCodeGlobalStoragePaths(): string[] {
  if (process.platform === "darwin") {
    return [
      join(homedir(), "Library", "Application Support", "Code", "User", "globalStorage"),
      join(homedir(), "Library", "Application Support", "Code - Insiders", "User", "globalStorage"),
      join(homedir(), "Library", "Application Support", "Cursor", "User", "globalStorage")
    ];
  }
  if (process.platform === "linux") {
    const base = process.env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config");
    return [
      join(base, "Code", "User", "globalStorage"),
      join(base, "Code - Insiders", "User", "globalStorage"),
      join(base, "Cursor", "User", "globalStorage")
    ];
  }
  const appData = process.env["APPDATA"] ?? join(homedir(), "AppData", "Roaming");
  return [
    join(appData, "Code", "User", "globalStorage"),
    join(appData, "Code - Insiders", "User", "globalStorage"),
    join(appData, "Cursor", "User", "globalStorage")
  ];
}

function extractText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const parts = content
    .filter(
      (part): part is { type: string; text: string } =>
        typeof part === "object" &&
        part !== null &&
        part.type === "text" &&
        typeof part.text === "string"
    )
    .map((part) => part.text);
  return parts.length > 0 ? parts.join(" ") : null;
}

interface ClineMessage {
  role?: string;
  content?: unknown;
  ts?: string;
}
