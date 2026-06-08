import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMessages, renderReport } from "../dist/lib/index.js";

test("renders a terminal report without snippets by default", () => {
  process.env.NO_COLOR = "1";
  const report = analyzeMessages([{ text: "fix this", agent: "codex", session: "s1" }]);
  const output = renderReport(report);

  assert.match(output, /PROMPT CRIMES REPORT/);
  assert.match(output, /Crime Index/);
  assert.doesNotMatch(output, /AI Dependency Index/);
  assert.match(output, /case summary/);
  assert.match(output, /Vague Prompting/);
  assert.match(output, /Vague Prompting x1: Filing tickets with the acceptance criteria of a shrug\./);
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

test("renders aggregate impact badges separately from message severity", () => {
  process.env.NO_COLOR = "1";
  const report = analyzeMessages(
    Array.from({ length: 10 }, (_, index) => ({
      text: `fix this ${index}`,
      agent: "codex",
      session: "s1"
    }))
  );
  const output = renderReport(report);

  assert.equal(report.categories[0].category, "vague_prompt");
  assert.equal(report.categories[0].severity, "moderate");
  assert.equal(report.categories[0].impact, "major");
  assert.match(output, /MAJOR\s+Vague Prompting\s+10/);
});

test("marks most charges and highest rate separately in by-agent output", () => {
  process.env.NO_COLOR = "1";
  const report = analyzeMessages([
    ...Array.from({ length: 4 }, () => ({ text: "fix this", agent: "cursor", session: "s1" })),
    ...Array.from({ length: 100 }, () => ({
      text: "The feature branch includes a login form and a redirect handler.",
      agent: "cursor",
      session: "s1"
    })),
    ...Array.from({ length: 3 }, () => ({ text: "fix this", agent: "opencode", session: "s2" })),
    ...Array.from({ length: 7 }, () => ({
      text: "The feature branch includes a login form and a redirect handler.",
      agent: "opencode",
      session: "s2"
    }))
  ]);
  const output = renderReport(report);

  assert.match(output, /cursor\s+4 charges in\s+104 messages .*\bmost charges\b/);
  assert.match(output, /opencode\s+3 charges in\s+10 messages .*\bhighest rate\b/);
  assert.doesNotMatch(output, /repeat offender/);
});
