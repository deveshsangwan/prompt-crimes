import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMessages, renderReport } from "../dist/lib/index.js";

test("renders a terminal report without snippets by default", () => {
  process.env.NO_COLOR = "1";
  const report = analyzeMessages([{ text: "fix this", agent: "codex", session: "s1" }]);
  const output = renderReport(report);

  assert.match(output, /PROMPT CRIMES REPORT/);
  assert.match(output, /AI Dependency Index/);
  assert.match(output, /Vague Prompting/);
  assert.match(output, /Vague Prompting x1: Asking "Vague Prompting" to carry the whole sprint in a tote bag\./);
  assert.match(output, /snippets hidden by default/);
  assert.doesNotMatch(output, /fix this/);
});

test("renders sanitized snippets when requested", () => {
  process.env.NO_COLOR = "1";
  const report = analyzeMessages(
    [{ text: "fix this in /Users/example/secret/project", agent: "codex", session: "s1" }],
    { includeSnippets: true }
  );
  const output = renderReport(report, { showSnippets: true });

  assert.match(output, /\[path\]/);
  assert.doesNotMatch(output, /\/Users\/example/);
});
