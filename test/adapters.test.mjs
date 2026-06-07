import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  opencodeAdapter,
  parseClaudeJsonl,
  parseCodexJsonl,
  parseCursorJsonl
} from "../dist/lib/index.js";

const { DatabaseSync } = await import("node:sqlite");

async function collect(generator) {
  const items = [];
  for await (const item of generator) items.push(item);
  return items;
}

test("parses Codex JSONL user messages", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prompt-crimes-codex-"));
  const file = join(dir, "session.jsonl");
  await writeFile(
    file,
    [
      JSON.stringify({ timestamp: "2026-01-01T00:00:00.000Z", type: "response_item", payload: { role: "user", content: [{ type: "input_text", text: "fix this" }] } }),
      JSON.stringify({ timestamp: "2026-01-01T00:00:01.000Z", type: "response_item", payload: { role: "assistant", content: [] } }),
      JSON.stringify({ timestamp: "2026-01-01T00:00:02.000Z", type: "response_item", payload: { role: "user", content: [{ type: "input_text", text: "<environment_context>skip</environment_context>" }] } })
    ].join("\n")
  );

  const messages = await collect(parseCodexJsonl(file, { session: "session" }));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, "fix this");
});

test("parses Claude JSONL user messages", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prompt-crimes-claude-"));
  const file = join(dir, "session.jsonl");
  await writeFile(
    file,
    JSON.stringify({ type: "user", timestamp: "2026-01-01T00:00:00.000Z", message: { content: [{ type: "text", text: "thoughts?" }] } })
  );

  const messages = await collect(parseClaudeJsonl(file, { session: "session", project: "project" }));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, "thoughts?");
  assert.equal(messages[0].project, "project");
});

test("parses Cursor JSONL user query wrapper", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prompt-crimes-cursor-"));
  const file = join(dir, "session.jsonl");
  await writeFile(
    file,
    JSON.stringify({
      role: "user",
      message: {
        content: [{ type: "text", text: "<timestamp>2026-01-01T00:00:00.000Z</timestamp><user_query>still broken</user_query>" }]
      }
    })
  );

  const messages = await collect(parseCursorJsonl(file, { session: "session", project: "project" }));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, "still broken");
});

test("reads OpenCode SQLite messages from XDG_DATA_HOME", async () => {
  const root = await mkdtemp(join(tmpdir(), "prompt-crimes-opencode-"));
  const dataDir = join(root, "opencode");
  await mkdir(dataDir);
  const dbPath = join(dataDir, "opencode.db");
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE message (id TEXT, session_id TEXT, time_created INTEGER, data TEXT);
    CREATE TABLE part (id TEXT, message_id TEXT, session_id TEXT, time_created INTEGER, data TEXT);
  `);
  db.prepare("INSERT INTO message VALUES (?, ?, ?, ?)").run("m1", "s1", 1767225600000, JSON.stringify({ role: "user" }));
  db.prepare("INSERT INTO part VALUES (?, ?, ?, ?, ?)").run("p1", "m1", "s1", 1767225600000, JSON.stringify({ type: "text", text: "you decide" }));
  db.close();

  const previous = process.env.XDG_DATA_HOME;
  process.env.XDG_DATA_HOME = root;
  try {
    const messages = await collect(opencodeAdapter().messages());
    assert.equal(messages.length, 1);
    assert.equal(messages[0].text, "you decide");
  } finally {
    if (previous === undefined) {
      delete process.env.XDG_DATA_HOME;
    } else {
      process.env.XDG_DATA_HOME = previous;
    }
  }
});
