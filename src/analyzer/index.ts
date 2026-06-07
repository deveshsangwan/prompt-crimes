import type { Message } from "../adapters";
import {
  CATEGORY_LABELS,
  CATEGORY_POINTS,
  CONTEXT_DUMP_PATTERNS,
  DECISION_OUTSOURCING_PATTERNS,
  ERROR_DUMP_PATTERNS,
  PING_PONG_PATTERNS,
  SNIPPET_SANITIZERS,
  TEXT_PATTERNS,
  VAGUE_PROMPT_PATTERNS,
  VALIDATION_SEEKING_PATTERNS
} from "./patterns";

export type CrimeCategory =
  | "vague_prompt"
  | "context_dump"
  | "validation_seeking"
  | "decision_outsourcing"
  | "error_dump_no_context"
  | "prompt_ping_pong";

export type CrimeSeverity = "minor" | "moderate" | "severe";

export interface MessageMeta {
  agent?: string;
  session?: string;
  project?: string;
  timestamp?: string;
}

export interface CrimeEvidence {
  category: CrimeCategory;
  severity: CrimeSeverity;
  points: number;
  reason: string;
  snippet?: string;
  messageMeta: MessageMeta;
}

export interface CategorySummary {
  category: CrimeCategory;
  label: string;
  count: number;
  points: number;
  severity: CrimeSeverity;
  examples: CrimeEvidence[];
}

export interface AgentSummary {
  messages: number;
  crimes: number;
  points: number;
}

export interface CrimeReport {
  totals: {
    messages: number;
    crimes: number;
    points: number;
    agents: number;
    sessions: number;
    dateRange?: { from: string; to: string };
  };
  perAgent: Record<string, AgentSummary>;
  categories: CategorySummary[];
  evidence: CrimeEvidence[];
  aiDependencyIndex: number;
  verdict: string;
  charges: string[];
}

interface AnalyzeOptions {
  includeSnippets?: boolean;
}

interface TextStats {
  normalized: string;
  words: string[];
  wordCount: number;
  lineCount: number;
  codeLines: number;
  errorLines: number;
  questionMarks: number;
}

export function analyzeMessages(messages: Message[], options: AnalyzeOptions = {}): CrimeReport {
  const evidence: CrimeEvidence[] = [];
  const perAgent: Record<string, AgentSummary> = {};
  const sessionShortPrompts = new Map<string, number>();

  for (const message of messages) {
    const agent = message.agent ?? "unknown";
    perAgent[agent] ??= { messages: 0, crimes: 0, points: 0 };
    perAgent[agent].messages++;

    const textEvidence = analyzeText(message.text, {
      includeSnippets: options.includeSnippets,
      meta: messageMeta(message)
    });

    const sessionKey = `${agent}:${message.session ?? "no-session"}`;
    if (isPingPongCandidate(message.text)) {
      const count = (sessionShortPrompts.get(sessionKey) ?? 0) + 1;
      sessionShortPrompts.set(sessionKey, count);
      if (count >= 3 && !textEvidence.some((item) => item.category === "prompt_ping_pong")) {
        textEvidence.push(createEvidence("prompt_ping_pong", "moderate", "rapid-fire follow-up with almost no new information", message.text, message, options.includeSnippets));
      }
    }

    for (const item of textEvidence) {
      evidence.push(item);
      perAgent[agent].crimes++;
      perAgent[agent].points += item.points;
    }
  }

  const categories = summarizeCategories(evidence);
  const dateRange = buildDateRange(messages);
  const aiDependencyIndex = computeAiDependencyIndex(messages, evidence);
  const verdict = getVerdict(aiDependencyIndex);

  return {
    totals: {
      messages: messages.length,
      crimes: evidence.length,
      points: evidence.reduce((sum, item) => sum + item.points, 0),
      agents: Object.keys(perAgent).length,
      sessions: new Set(messages.map((message) => `${message.agent ?? "unknown"}:${message.session ?? ""}`)).size,
      ...(dateRange ? { dateRange } : {})
    },
    perAgent,
    categories,
    evidence: evidence.sort((a, b) => b.points - a.points),
    aiDependencyIndex,
    verdict,
    charges: generateCharges(categories, aiDependencyIndex)
  };
}

export function analyzeText(
  text: string,
  options: AnalyzeOptions & { meta?: MessageMeta } = {}
): CrimeEvidence[] {
  const stats = getStats(text);
  const evidence: CrimeEvidence[] = [];
  const meta = options.meta ?? {};

  if (isVaguePrompt(stats)) {
    evidence.push(createEvidence("vague_prompt", stats.wordCount <= 4 ? "moderate" : "minor", "the ask is doing interpretive dance instead of requirements", text, meta, options.includeSnippets));
  }

  if (isContextDump(stats)) {
    evidence.push(createEvidence("context_dump", stats.wordCount > 900 || stats.lineCount > 80 ? "severe" : "moderate", "big paste energy with a suspiciously tiny ask", text, meta, options.includeSnippets));
  }

  if (isValidationSeeking(stats.normalized)) {
    evidence.push(createEvidence("validation_seeking", "moderate", "asked the model to become a confidence vending machine", text, meta, options.includeSnippets));
  }

  if (isDecisionOutsourcing(stats.normalized)) {
    evidence.push(createEvidence("decision_outsourcing", "moderate", "outsourced taste, judgment, and possibly free will", text, meta, options.includeSnippets));
  }

  if (isErrorDumpNoContext(stats)) {
    evidence.push(createEvidence("error_dump_no_context", stats.errorLines >= 8 ? "severe" : "moderate", "delivered the stack trace and fled the scene", text, meta, options.includeSnippets));
  }

  if (isPingPongCandidate(text)) {
    evidence.push(createEvidence("prompt_ping_pong", "minor", "follow-up contains less context than a fortune cookie", text, meta, options.includeSnippets));
  }

  return dedupeCategories(evidence);
}

export function getVerdict(index: number): string {
  if (index >= 85) return "Autocomplete Life Coach";
  if (index >= 70) return "Stack Trace Sommelier";
  if (index >= 55) return "Rubber Duck With Wi-Fi";
  if (index >= 35) return "Casual Context Arsonist";
  if (index >= 18) return "Mostly Harmless Prompt Tourist";
  return "Independent Operator";
}

function messageMeta(message: Message): MessageMeta {
  return {
    agent: message.agent,
    session: message.session,
    project: message.project,
    timestamp: message.timestamp
  };
}

function createEvidence(
  category: CrimeCategory,
  severity: CrimeSeverity,
  reason: string,
  text: string,
  meta: MessageMeta,
  includeSnippet?: boolean
): CrimeEvidence {
  const multiplier = severity === "severe" ? 1.6 : severity === "moderate" ? 1.25 : 1;
  return {
    category,
    severity,
    points: Math.round(CATEGORY_POINTS[category] * multiplier),
    reason,
    ...(includeSnippet ? { snippet: sanitizeSnippet(text) } : {}),
    messageMeta: meta
  };
}

function dedupeCategories(evidence: CrimeEvidence[]): CrimeEvidence[] {
  const best = new Map<CrimeCategory, CrimeEvidence>();
  for (const item of evidence) {
    const existing = best.get(item.category);
    if (!existing || item.points > existing.points) best.set(item.category, item);
  }
  return [...best.values()];
}

function getStats(text: string): TextStats {
  const normalized = normalize(text);
  const words = normalized.match(TEXT_PATTERNS.word) ?? [];
  const lines = text.split(TEXT_PATTERNS.lineBreak);
  const codeLines = lines.filter((line) => TEXT_PATTERNS.codeLine.test(line)).length;
  const errorLines = lines.filter((line) => TEXT_PATTERNS.errorLine.test(line)).length;

  return {
    normalized,
    words,
    wordCount: words.length,
    lineCount: lines.length,
    codeLines,
    errorLines,
    questionMarks: (text.match(TEXT_PATTERNS.questionMark) ?? []).length
  };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(TEXT_PATTERNS.codeBlock, " codeblock ")
    .replace(TEXT_PATTERNS.whitespace, " ")
    .trim();
}

function isVaguePrompt(stats: TextStats): boolean {
  const text = stats.normalized;
  if (VAGUE_PROMPT_PATTERNS.exactAsk.test(text)) {
    return true;
  }
  if (stats.wordCount <= 7 && VAGUE_PROMPT_PATTERNS.shortAction.test(text)) {
    return true;
  }
  if (stats.wordCount <= 12 && VAGUE_PROMPT_PATTERNS.shortPhrase.test(text)) {
    return true;
  }
  return false;
}

function isContextDump(stats: TextStats): boolean {
  const tinyAsk = CONTEXT_DUMP_PATTERNS.tinyAsk.test(stats.normalized);
  const heavyPaste = stats.wordCount >= 350 || stats.lineCount >= 35 || stats.codeLines >= 12;
  return heavyPaste && (tinyAsk || stats.codeLines >= 18 || stats.wordCount >= 700);
}

function isValidationSeeking(text: string): boolean {
  const hits = VALIDATION_SEEKING_PATTERNS.filter((pattern) => pattern.test(text)).length;
  return hits > 0;
}

function isDecisionOutsourcing(text: string): boolean {
  return DECISION_OUTSOURCING_PATTERNS.some((pattern) => pattern.test(text));
}

function isErrorDumpNoContext(stats: TextStats): boolean {
  if (stats.errorLines < 3) return false;
  const hasContext = ERROR_DUMP_PATTERNS.contextClues.test(stats.normalized);
  const contextWords = stats.words.filter((word) => ERROR_DUMP_PATTERNS.contextWords.has(word)).length;
  return !hasContext && contextWords < 2;
}

function isPingPongCandidate(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  if (PING_PONG_PATTERNS.exact.test(normalized)) {
    return true;
  }
  const words = normalized.match(TEXT_PATTERNS.word) ?? [];
  return words.length <= 4 && PING_PONG_PATTERNS.keyword.test(normalized);
}

function summarizeCategories(evidence: CrimeEvidence[]): CategorySummary[] {
  const summaries = new Map<CrimeCategory, CategorySummary>();

  for (const item of evidence) {
    const summary = summaries.get(item.category) ?? {
      category: item.category,
      label: CATEGORY_LABELS[item.category],
      count: 0,
      points: 0,
      severity: "minor" as CrimeSeverity,
      examples: []
    };

    summary.count++;
    summary.points += item.points;
    summary.severity = maxSeverity(summary.severity, item.severity);
    if (summary.examples.length < 3) summary.examples.push(item);
    summaries.set(item.category, summary);
  }

  return [...summaries.values()].sort((a, b) => b.points - a.points || b.count - a.count);
}

function maxSeverity(a: CrimeSeverity, b: CrimeSeverity): CrimeSeverity {
  const rank: Record<CrimeSeverity, number> = { minor: 1, moderate: 2, severe: 3 };
  return rank[b] > rank[a] ? b : a;
}

function buildDateRange(messages: Message[]): { from: string; to: string } | undefined {
  const timestamps = messages
    .map((message) => (message.timestamp ? new Date(message.timestamp) : null))
    .filter((date): date is Date => date !== null && !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const first = timestamps[0];
  const last = timestamps[timestamps.length - 1];
  if (!first || !last) return undefined;
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

function computeAiDependencyIndex(messages: Message[], evidence: CrimeEvidence[]): number {
  if (messages.length === 0) return 0;

  const weighted = evidence.reduce((sum, item) => {
    const extra =
      item.category === "decision_outsourcing" || item.category === "validation_seeking"
        ? 4
        : item.category === "prompt_ping_pong"
          ? 3
          : 0;
    return sum + item.points + extra;
  }, 0);
  const density = weighted / Math.max(messages.length, 1);
  const volumeBoost = Math.min(18, Math.log10(messages.length + 1) * 8);
  return Math.max(0, Math.min(100, Math.round(density * 7 + volumeBoost)));
}

function generateCharges(categories: CategorySummary[], index: number): string[] {
  if (categories.length === 0) {
    return ["No major crimes detected. Suspiciously well-adjusted prompting."];
  }

  const charges = categories.slice(0, 5).map((category) => {
    switch (category.category) {
      case "vague_prompt":
        return `Count ${category.count}: Asking "${category.label}" to carry the whole sprint in a tote bag.`;
      case "context_dump":
        return `Count ${category.count}: Releasing a context avalanche and calling it collaboration.`;
      case "validation_seeking":
        return `Count ${category.count}: Using the model as a tiny approval desk.`;
      case "decision_outsourcing":
        return `Count ${category.count}: Handing the steering wheel to autocomplete.`;
      case "error_dump_no_context":
        return `Count ${category.count}: Mailing a stack trace with no return address.`;
      case "prompt_ping_pong":
        return `Count ${category.count}: Conducting debugging via emotionally loaded Morse code.`;
    }
  });

  if (index >= 70) {
    charges.unshift("The court notes a powerful dependence on silicon reassurance.");
  }

  return charges.slice(0, 5);
}

function sanitizeSnippet(text: string): string {
  return SNIPPET_SANITIZERS.reduce(
    (value, sanitizer) => value.replace(sanitizer.pattern, sanitizer.replacement),
    text
  )
    .trim()
    .slice(0, 160);
}
