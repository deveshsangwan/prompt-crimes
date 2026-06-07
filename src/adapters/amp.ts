import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Adapter, AdapterOptions, Message } from "./index";

function getAmpThreadsDir(): string {
  return join(
    process.env["XDG_DATA_HOME"] ?? join(homedir(), ".local", "share"),
    "amp",
    "threads"
  );
}

export function ampAdapter(): Adapter {
  return {
    name: "amp",
    async *messages(options?: AdapterOptions): AsyncGenerator<Message> {
      const files = await readdir(getAmpThreadsDir()).catch(() => [] as string[]);

      for (const file of files.filter((entry) => entry.endsWith(".json"))) {
        const threadId = file.replace(".json", "");
        const filePath = join(getAmpThreadsDir(), file);

        try {
          const raw = await readFile(filePath, "utf-8");
          const thread = JSON.parse(raw) as AmpThread;
          if (!Array.isArray(thread.messages)) continue;

          for (const message of thread.messages) {
            if (message.role !== "user") continue;
            const text = extractText(message.content);
            if (!text) continue;

            const timestamp = message.timestamp ?? message.createdAt ?? undefined;
            if (options?.since && timestamp) {
              const ts = new Date(timestamp);
              if (ts < options.since) continue;
            }

            yield { text, timestamp, session: threadId };
          }
        } catch {
          // Skip malformed thread files.
        }
      }
    }
  };
}

function extractText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const parts = content
    .filter(
      (part): part is { text: string } =>
        typeof part === "object" && part !== null && typeof part.text === "string"
    )
    .map((part) => part.text);
  return parts.length > 0 ? parts.join(" ") : null;
}

interface AmpMessage {
  role?: string;
  content?: unknown;
  timestamp?: string;
  createdAt?: string;
}

interface AmpThread {
  messages?: AmpMessage[];
}
