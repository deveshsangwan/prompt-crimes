import { createReadStream, existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Adapter, AdapterOptions, Message } from "./index";

const CURSOR_PROJECTS_DIR = join(homedir(), ".cursor", "projects");

export function cursorAdapter(): Adapter {
  return {
    name: "cursor",
    async *messages(options?: AdapterOptions): AsyncGenerator<Message> {
      if (!existsSync(CURSOR_PROJECTS_DIR)) return;
      const projectDirs = await readdir(CURSOR_PROJECTS_DIR).catch(() => [] as string[]);

      for (const projectDir of projectDirs) {
        const transcriptsDir = join(CURSOR_PROJECTS_DIR, projectDir, "agent-transcripts");
        if (!existsSync(transcriptsDir)) continue;
        yield* walkTranscripts(transcriptsDir, { project: projectDir, since: options?.since });
      }
    }
  };
}

async function* walkTranscripts(
  dir: string,
  context: { project: string; since?: Date }
): AsyncGenerator<Message> {
  const entries = await readdir(dir).catch(() => [] as string[]);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const entryStat = await stat(fullPath).catch(() => null);
    if (!entryStat) continue;

    if (entryStat.isDirectory()) {
      if (context.since && entryStat.mtime < context.since) continue;
      const subEntries = await readdir(fullPath).catch(() => [] as string[]);
      for (const sub of subEntries) {
        if (sub.endsWith(".jsonl")) {
          yield* parseCursorJsonl(join(fullPath, sub), {
            session: sub.replace(".jsonl", ""),
            project: context.project,
            since: context.since
          });
        } else if (sub === "subagents") {
          const subFiles = await readdir(join(fullPath, "subagents")).catch(() => [] as string[]);
          for (const file of subFiles.filter((item) => item.endsWith(".jsonl"))) {
            yield* parseCursorJsonl(join(fullPath, "subagents", file), {
              session: `${entry}/${file.replace(".jsonl", "")}`,
              project: context.project,
              since: context.since
            });
          }
        }
      }
    } else if (entry.endsWith(".jsonl")) {
      if (context.since && entryStat.mtime < context.since) continue;
      yield* parseCursorJsonl(fullPath, {
        session: entry.replace(".jsonl", ""),
        project: context.project,
        since: context.since
      });
    }
  }
}

export async function* parseCursorJsonl(
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
      if (entry["type"] === "metadata" || entry["type"] === "error") continue;
      if (entry["role"] !== "user") continue;

      const message = entry["message"] as { content?: unknown } | undefined;
      const rawText = extractText(message?.content);
      if (!rawText) continue;

      const text = stripSystemContext(rawText);
      if (!text.trim()) continue;

      const timestamp = extractTimestamp(rawText) ?? undefined;
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

function stripSystemContext(text: string): string {
  const queryMatch = text.match(/<user_query>\n?([\s\S]*?)\n?<\/user_query>/);
  if (queryMatch?.[1]) return queryMatch[1].trim();

  return text
    .replace(/<timestamp>[\s\S]*?<\/timestamp>/g, "")
    .replace(/<user_info>[\s\S]*?<\/user_info>/g, "")
    .replace(/<system_reminder>[\s\S]*?<\/system_reminder>/g, "")
    .replace(/<rules>[\s\S]*?<\/rules>/g, "")
    .replace(/<attached_files>[\s\S]*?<\/attached_files>/g, "")
    .replace(/<agent_transcripts>[\s\S]*?<\/agent_transcripts>/g, "")
    .replace(/<agent_skills>[\s\S]*?<\/agent_skills>/g, "")
    .replace(/<mcp_file_system>[\s\S]*?<\/mcp_file_system>/g, "")
    .trim();
}

function extractTimestamp(text: string): string | null {
  const match = text.match(/<timestamp>([\s\S]*?)<\/timestamp>/);
  return match?.[1] ? match[1].trim() : null;
}
