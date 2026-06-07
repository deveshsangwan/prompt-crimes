import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Adapter, AdapterOptions, Message } from "./index";

const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");

export function claudeAdapter(): Adapter {
  return {
    name: "claude",
    async *messages(options?: AdapterOptions): AsyncGenerator<Message> {
      let projectDirs: string[];
      try {
        projectDirs = await readdir(CLAUDE_PROJECTS_DIR);
      } catch {
        return;
      }

      for (const projectDir of projectDirs) {
        const projectPath = join(CLAUDE_PROJECTS_DIR, projectDir);
        const projectStat = await stat(projectPath).catch(() => null);
        if (!projectStat?.isDirectory()) continue;

        const entries = await readdir(projectPath).catch(() => [] as string[]);
        for (const file of entries.filter((entry) => entry.endsWith(".jsonl"))) {
          yield* parseClaudeJsonl(join(projectPath, file), {
            session: file.replace(".jsonl", ""),
            project: projectDir,
            since: options?.since
          });
        }

        for (const subdir of entries.filter((entry) => !entry.includes("."))) {
          const subagentsDir = join(projectPath, subdir, "subagents");
          const subFiles = await readdir(subagentsDir).catch(() => [] as string[]);
          for (const file of subFiles.filter((entry) => entry.endsWith(".jsonl"))) {
            yield* parseClaudeJsonl(join(subagentsDir, file), {
              session: `${subdir}/${file.replace(".jsonl", "")}`,
              project: projectDir,
              since: options?.since
            });
          }
        }
      }
    }
  };
}

export async function* parseClaudeJsonl(
  filePath: string,
  context: { session: string; project: string; since?: Date }
): AsyncGenerator<Message> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      const text = extractUserText(entry);
      if (!text) continue;

      const timestamp = extractTimestamp(entry) ?? undefined;
      if (context.since && timestamp) {
        const ts = new Date(timestamp);
        if (ts < context.since) continue;
      }

      yield {
        text,
        timestamp,
        session: context.session,
        project: context.project
      };
    } catch {
      // Skip malformed JSONL rows.
    }
  }
}

function extractUserText(entry: Record<string, unknown>): string | null {
  if (entry["type"] === "user" || entry["type"] === "human") {
    const message = entry["message"] as Record<string, unknown> | undefined;
    return message ? contentToString(message["content"]) : null;
  }
  if (entry["role"] === "user") return contentToString(entry["content"]);
  return null;
}

function contentToString(content: unknown): string | null {
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

function extractTimestamp(entry: Record<string, unknown>): string | null {
  if (typeof entry["timestamp"] === "string") return entry["timestamp"];
  if (typeof entry["createdAt"] === "string") return entry["createdAt"];
  return null;
}
