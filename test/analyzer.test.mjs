import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMessages, analyzeText, getVerdict } from "../dist/lib/index.js";

function categories(text) {
  return analyzeText(text).map((item) => item.category);
}

test("detects vague prompts", () => {
  assert.ok(categories("fix this").includes("vague_prompt"));
  assert.ok(categories("thoughts?").includes("vague_prompt"));
  assert.equal(categories("Please update the login form to validate email before submit.").includes("vague_prompt"), false);
});

test("detects context dumps", () => {
  const code = Array.from({ length: 40 }, (_, index) => `const value${index} = ${index};`).join("\n");
  assert.ok(categories(`${code}\n\nfix?`).includes("context_dump"));
  assert.equal(categories("Here is the failing command and expected behavior. Please help debug.").includes("context_dump"), false);
});

test("detects validation seeking", () => {
  assert.ok(categories("Does this make sense or am I missing something?").includes("validation_seeking"));
  assert.equal(categories("Implement the selected approach.").includes("validation_seeking"), false);
});

test("detects decision outsourcing", () => {
  assert.ok(categories("Which framework should I use? Pick the best option.").includes("decision_outsourcing"));
  assert.equal(categories("Use Next.js because this app already runs on Vercel.").includes("decision_outsourcing"), false);
});

test("detects error dumps without context", () => {
  const trace = `TypeError: nope\n    at run (app.js:1)\n    at main (app.js:2)\nCaused by: Error: failed`;
  assert.ok(categories(trace).includes("error_dump_no_context"));
  assert.equal(categories(`I ran npm test after upgrading Node. Expected green tests.\n${trace}`).includes("error_dump_no_context"), false);
});

test("detects prompt ping-pong", () => {
  assert.ok(categories("still broken").includes("prompt_ping_pong"));
  assert.equal(categories("The login redirect is still broken after clicking submit.").includes("prompt_ping_pong"), false);
});

test("scores and verdicts are normalized", () => {
  const report = analyzeMessages([
    { text: "fix this", agent: "codex", session: "a" },
    { text: "Which one should I use? You decide.", agent: "codex", session: "a" },
    { text: "again", agent: "codex", session: "a" },
    { text: "still broken", agent: "codex", session: "a" },
    { text: "wrong", agent: "codex", session: "a" }
  ]);

  assert.equal(report.totals.messages, 5);
  assert.ok(report.aiDependencyIndex >= 0);
  assert.ok(report.aiDependencyIndex <= 100);
  assert.equal(typeof getVerdict(report.aiDependencyIndex), "string");
  assert.ok(report.categories.some((category) => category.category === "decision_outsourcing"));
  assert.ok(report.categories.some((category) => category.category === "prompt_ping_pong"));
});
