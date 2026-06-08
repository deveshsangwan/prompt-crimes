import assert from "node:assert/strict";
import test from "node:test";
import {
  REASON_TEMPLATES,
  analyzeMessages,
  analyzeText,
  detectHealthySignals,
  getVerdict,
  pickTemplate
} from "../dist/lib/index.js";

function categories(text) {
  return analyzeText(text).map((item) => item.category);
}

test("detects vague prompts", () => {
  assert.ok(categories("fix this").includes("vague_prompt"));
  assert.ok(categories("thoughts?").includes("vague_prompt"));
  assert.ok(categories("check").includes("vague_prompt"));
  assert.ok(categories("issue?").includes("vague_prompt"));
  assert.ok(categories("why?").includes("vague_prompt"));
  assert.ok(categories("help pls").includes("vague_prompt"));
  assert.ok(categories("fix fast").includes("vague_prompt"));
  assert.ok(categories("not working").includes("vague_prompt"));
  assert.ok(categories("any idea?").includes("vague_prompt"));
  assert.equal(categories("Please update the login form to validate email before submit.").includes("vague_prompt"), false);
});

test("uses configured vague prompt roast reasons", () => {
  const evidence = analyzeText("issue?").find((item) => item.category === "vague_prompt");
  assert.ok(evidence);
  assert.ok(REASON_TEMPLATES.vague_prompt.includes(evidence.reason));
  assert.equal(evidence.reason, pickTemplate("vague_prompt", "issue?"));
  assert.equal(pickTemplate("vague_prompt", "issue?"), pickTemplate("vague_prompt", "issue?"));
});

test("reason template selection avoids simple character-sum collisions", () => {
  assert.notEqual(pickTemplate("vague_prompt", "abc"), pickTemplate("vague_prompt", "acb"));
});

test("detects context dumps", () => {
  const code = Array.from({ length: 40 }, (_, index) => `const value${index} = ${index};`).join("\n");
  assert.ok(categories(`${code}\n\nfix?`).includes("context_dump"));
  assert.equal(categories("Here is the failing command and expected behavior. Please help debug.").includes("context_dump"), false);
});

test("detects JSON and log walls as context dumps", () => {
  const jsonWall = Array.from({ length: 22 }, (_, index) => `  "field${index}": "value${index}",`).join("\n");
  const logWall = Array.from(
    { length: 16 },
    (_, index) => `2026-01-01T00:00:${String(index).padStart(2, "0")}Z INFO request ${index}`
  ).join("\n");

  assert.ok(categories(`{\n${jsonWall}\n}\n\nfix?`).includes("context_dump"));
  assert.ok(categories(`${logWall}\n\nwhat now?`).includes("context_dump"));
});

test("detects context without a clear question", () => {
  const architectureNotes = Array.from(
    { length: 26 },
    (_, index) => `Service ${index} emits an event into the queue and the worker stores the result.`
  ).join("\n");
  const codeContext = Array.from({ length: 12 }, (_, index) => `const service${index} = createService();`).join("\n");

  assert.ok(categories(`Here is my architecture.\n${architectureNotes}`).includes("context_without_question"));
  assert.ok(categories(`Here is the relevant setup.\n${codeContext}`).includes("context_without_question"));
  assert.equal(categories(`Here is my architecture.\n${architectureNotes}\n\nWhat should I change?`).includes("context_without_question"), false);
  assert.equal(categories(`Here is my architecture.\n${architectureNotes}\n\nPlease review it.`).includes("context_without_question"), false);
});

test("does not flag large coding-agent instructions as context without question", () => {
  const notes = Array.from(
    { length: 30 },
    (_, index) => `Migration note ${index} maps the old offer field into the new offer response model.`
  ).join("\n");
  const setup = Array.from({ length: 14 }, (_, index) => `const offer${index} = createOfferFixture();`).join("\n");

  assert.equal(
    categories(`Explore how Hero migrated from the old offer screen. Focus on these files.\n${notes}`).includes(
      "context_without_question"
    ),
    false
  );
  assert.equal(
    categories(`Add the partner-specific EMI logic and update the tests.\n${setup}`).includes("context_without_question"),
    false
  );
  assert.equal(
    categories(`For testing this I want to mock the integration response.\n${notes}`).includes(
      "context_without_question"
    ),
    false
  );
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
  assert.ok(categories("TypeError: Cannot read properties of undefined").includes("error_dump_no_context"));
  assert.equal(categories(`I ran npm test after upgrading Node. Expected green tests.\n${trace}`).includes("error_dump_no_context"), false);
  assert.equal(categories("After I updated pnpm in staging, TypeError: Cannot read properties of undefined").includes("error_dump_no_context"), false);
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
  assert.ok(report.crimeIndex >= 0);
  assert.ok(report.crimeIndex <= 100);
  assert.equal(typeof getVerdict(report.crimeIndex), "string");
  assert.ok(report.categories.some((category) => category.category === "decision_outsourcing"));
  assert.ok(report.categories.some((category) => category.category === "prompt_ping_pong"));
  assert.equal(report.crimeIndexBreakdown.rates.crimeRate, report.totals.crimes / report.totals.messages);
  assert.equal(report.crimeIndexBreakdown.rates.pointsPerMessage, report.totals.points / report.totals.messages);
  assert.ok(report.crimeIndexBreakdown.scores.frequency > 0);
  assert.ok(report.crimeIndexBreakdown.scores.severity > 0);
});

test("healthy usage signals reduce the crime index", () => {
  const thinMessages = [
    { text: "Which one should I use?", agent: "codex", session: "a" },
    ...Array.from({ length: 9 }, () => ({
      text: "Here are some notes about the implementation status.",
      agent: "codex",
      session: "a"
    }))
  ];
  const healthyMessages = [
    { text: "Which one should I use?", agent: "codex", session: "a" },
    ...Array.from({ length: 9 }, () => ({
      text: "I ran the benchmarks and expected lower latency, but the actual result was slower. Help me understand the tradeoff.",
      agent: "codex",
      session: "a"
    }))
  ];

  const thinReport = analyzeMessages(thinMessages);
  const healthyReport = analyzeMessages(healthyMessages);

  assert.ok(healthyReport.crimeIndex < thinReport.crimeIndex);
  assert.ok(healthyReport.crimeIndexBreakdown.healthyDiscount > 0);
  assert.equal(healthyReport.healthySignals.shows_attempt, 9);
  assert.ok(detectHealthySignals("Explain how does this cache work? I tried the docs first.").includes("learning"));
});

test("higher crime rate and point density produce a higher crime index", () => {
  const neutral = { text: "The feature branch includes a login form and a redirect handler.", agent: "codex", session: "a" };
  const lowCrimeReport = analyzeMessages([
    ...Array.from({ length: 10 }, () => ({ text: "fix this", agent: "codex", session: "a" })),
    ...Array.from({ length: 90 }, () => neutral)
  ]);
  const highCrimeReport = analyzeMessages([
    ...Array.from({ length: 20 }, () => ({ text: "TypeError: Cannot read properties of undefined", agent: "codex", session: "a" })),
    ...Array.from({ length: 80 }, () => neutral)
  ]);

  assert.ok(highCrimeReport.totals.crimes > lowCrimeReport.totals.crimes);
  assert.ok(highCrimeReport.crimeIndex > lowCrimeReport.crimeIndex);
});

test("context without question contributes to the crime index", () => {
  const neutral = { text: "The feature branch includes a login form and a redirect handler.", agent: "codex", session: "a" };
  const contextWithoutQuestion = Array.from(
    { length: 26 },
    (_, index) => `Service ${index} emits an event into the queue and the worker stores the result.`
  ).join("\n");
  const cleanReport = analyzeMessages([neutral]);
  const contextReport = analyzeMessages([{ text: contextWithoutQuestion, agent: "codex", session: "a" }]);

  assert.ok(contextReport.categories.some((category) => category.category === "context_without_question"));
  assert.ok(contextReport.crimeIndex > cleanReport.crimeIndex);
});
