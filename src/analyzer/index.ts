import type { Message } from "../adapters";
import {
  CATEGORY_LABELS,
  CATEGORY_POINTS,
  CONTEXT_DUMP_PATTERNS,
  CONTEXT_WITHOUT_QUESTION_PATTERNS,
  DECISION_OUTSOURCING_PATTERNS,
  ERROR_DUMP_PATTERNS,
  HEALTHY_SIGNAL_PATTERNS,
  PING_PONG_PATTERNS,
  REASON_TEMPLATES,
  SNIPPET_SANITIZERS,
  TEXT_PATTERNS,
  VAGUE_PROMPT_PATTERNS,
  VALIDATION_SEEKING_PATTERNS
} from "./patterns";

export type CrimeCategory =
  | "vague_prompt"
  | "context_dump"
  | "context_without_question"
  | "validation_seeking"
  | "decision_outsourcing"
  | "error_dump_no_context"
  | "prompt_ping_pong";

export type CrimeSeverity = "minor" | "moderate" | "severe";

export type HealthySignal = "learning" | "clear_context" | "specific_question" | "shows_attempt";

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

export interface AiDependencyBreakdown {
  rates: {
    validationRate: number;
    decisionRate: number;
    pingPongRate: number;
    vagueRate: number;
    errorNoContextRate: number;
    contextDumpRate: number;
  };
  scores: {
    validation: number;
    decision: number;
    pingPong: number;
    vague: number;
    errorNoContext: number;
    contextDump: number;
  };
  volumeBoost: number;
  healthyDiscount: number;
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
  healthySignals: Record<HealthySignal, number>;
  aiDependencyIndex: number;
  aiDependencyBreakdown: AiDependencyBreakdown;
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
  jsonLikeLines: number;
  logLikeLines: number;
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
        textEvidence.push(createEvidence("prompt_ping_pong", "moderate", message.text, message, options.includeSnippets));
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
  const healthySignals = summarizeHealthySignals(messages);
  const { index: aiDependencyIndex, breakdown: aiDependencyBreakdown } = computeAiDependencyIndex(messages, evidence);
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
    healthySignals,
    aiDependencyIndex,
    aiDependencyBreakdown,
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
    evidence.push(createEvidence("vague_prompt", stats.wordCount <= 4 ? "moderate" : "minor", text, meta, options.includeSnippets));
  }

  if (isContextDump(stats)) {
    evidence.push(createEvidence("context_dump", stats.wordCount > 900 || stats.lineCount > 80 ? "severe" : "moderate", text, meta, options.includeSnippets));
  }

  if (isContextWithoutQuestion(stats)) {
    evidence.push(createEvidence("context_without_question", "moderate", text, meta, options.includeSnippets));
  }

  if (isValidationSeeking(stats.normalized)) {
    evidence.push(createEvidence("validation_seeking", "moderate", text, meta, options.includeSnippets));
  }

  if (isDecisionOutsourcing(stats.normalized)) {
    evidence.push(createEvidence("decision_outsourcing", "moderate", text, meta, options.includeSnippets));
  }

  if (isErrorDumpNoContext(stats)) {
    evidence.push(createEvidence("error_dump_no_context", stats.errorLines >= 8 ? "severe" : "moderate", text, meta, options.includeSnippets));
  }

  if (isPingPongCandidate(text)) {
    evidence.push(createEvidence("prompt_ping_pong", "minor", text, meta, options.includeSnippets));
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
  text: string,
  meta: MessageMeta,
  includeSnippet?: boolean
): CrimeEvidence {
  const multiplier = severity === "severe" ? 1.6 : severity === "moderate" ? 1.25 : 1;
  return {
    category,
    severity,
    points: Math.round(CATEGORY_POINTS[category] * multiplier),
    reason: pickTemplate(category, text),
    ...(includeSnippet ? { snippet: sanitizeSnippet(text) } : {}),
    messageMeta: meta
  };
}

export function pickTemplate(category: CrimeCategory, text: string): string {
  const templates = REASON_TEMPLATES[category];
  const hash = stableHash(`${category}:${text}`);
  return templates[hash % templates.length] ?? templates[0] ?? "";
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
  const jsonLikeLines = lines.filter(
    (line) => TEXT_PATTERNS.jsonLikeLineStart.test(line) || TEXT_PATTERNS.jsonLikeLineEnd.test(line)
  ).length;
  const logLikeLines = lines.filter(
    (line) => TEXT_PATTERNS.logLevel.test(line) || TEXT_PATTERNS.isoDate.test(line)
  ).length;

  return {
    normalized,
    words,
    wordCount: words.length,
    lineCount: lines.length,
    codeLines,
    errorLines,
    jsonLikeLines,
    logLikeLines,
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
  if (VAGUE_PROMPT_PATTERNS.exactShortPanic.test(text)) {
    return true;
  }
  if (VAGUE_PROMPT_PATTERNS.exactBrokenState.test(text)) {
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
  const heavyPaste =
    stats.wordCount >= 350 ||
    stats.lineCount >= 35 ||
    stats.codeLines >= 12 ||
    stats.jsonLikeLines >= 20 ||
    stats.logLikeLines >= 15;
  return heavyPaste && (tinyAsk || stats.codeLines >= 18 || stats.wordCount >= 700);
}

function isContextWithoutQuestion(stats: TextStats): boolean {
  const hasBigContext = stats.wordCount >= 180 || stats.lineCount >= 25 || stats.codeLines >= 8;
  const hasQuestion = stats.questionMarks > 0;
  const hasAskVerb = CONTEXT_WITHOUT_QUESTION_PATTERNS.askVerb.test(stats.normalized);
  return hasBigContext && !hasQuestion && !hasAskVerb;
}

function isValidationSeeking(text: string): boolean {
  const hits = VALIDATION_SEEKING_PATTERNS.filter((pattern) => pattern.test(text)).length;
  return hits > 0;
}

function isDecisionOutsourcing(text: string): boolean {
  return DECISION_OUTSOURCING_PATTERNS.some((pattern) => pattern.test(text));
}

function isErrorDumpNoContext(stats: TextStats): boolean {
  const hasStrongError = ERROR_DUMP_PATTERNS.strongError.test(stats.normalized);
  if (!hasStrongError && stats.errorLines < 3) return false;
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

function computeAiDependencyIndex(
  messages: Message[],
  evidence: CrimeEvidence[]
): { index: number; breakdown: AiDependencyBreakdown } {
  if (messages.length === 0) {
    return {
      index: 0,
      breakdown: {
        rates: {
          validationRate: 0,
          decisionRate: 0,
          pingPongRate: 0,
          vagueRate: 0,
          errorNoContextRate: 0,
          contextDumpRate: 0
        },
        scores: {
          validation: 0,
          decision: 0,
          pingPong: 0,
          vague: 0,
          errorNoContext: 0,
          contextDump: 0
        },
        volumeBoost: 0,
        healthyDiscount: 0
      }
    };
  }

  const countByCategory = evidence.reduce(
    (counts, item) => {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
      return counts;
    },
    {} as Partial<Record<CrimeCategory, number>>
  );
  const rate = (category: CrimeCategory) => (countByCategory[category] ?? 0) / messages.length;
  const rates = {
    validationRate: rate("validation_seeking"),
    decisionRate: rate("decision_outsourcing"),
    pingPongRate: rate("prompt_ping_pong"),
    vagueRate: rate("vague_prompt"),
    errorNoContextRate: rate("error_dump_no_context"),
    contextDumpRate: rate("context_dump")
  };
  const scores = {
    validation: rates.validationRate * 22,
    decision: rates.decisionRate * 24,
    pingPong: rates.pingPongRate * 18,
    vague: rates.vagueRate * 14,
    errorNoContext: rates.errorNoContextRate * 14,
    contextDump: rates.contextDumpRate * 8
  };
  const volumeBoost = Math.min(18, Math.log10(messages.length + 1) * 8);
  const healthyCount = messages.filter((message) => {
    const signals = detectHealthySignals(message.text);
    return signals.includes("shows_attempt") || signals.includes("learning");
  }).length;
  const healthyRatio = healthyCount / messages.length;
  const healthyDiscount = healthyRatio * 12;
  const rawIndex =
    scores.validation +
    scores.decision +
    scores.pingPong +
    scores.vague +
    scores.errorNoContext +
    scores.contextDump +
    volumeBoost -
    healthyDiscount;

  return {
    index: clamp(Math.round(rawIndex), 0, 100),
    breakdown: {
      rates,
      scores,
      volumeBoost,
      healthyDiscount
    }
  };
}

function summarizeHealthySignals(messages: Message[]): Record<HealthySignal, number> {
  const summary: Record<HealthySignal, number> = {
    learning: 0,
    clear_context: 0,
    specific_question: 0,
    shows_attempt: 0
  };

  for (const message of messages) {
    for (const signal of detectHealthySignals(message.text)) {
      summary[signal]++;
    }
  }

  return summary;
}

export function detectHealthySignals(text: string): HealthySignal[] {
  const stats = getStats(text);
  const signals: HealthySignal[] = [];

  if (hasShowsAttempt(stats.normalized)) signals.push("shows_attempt");
  if (hasSpecificQuestion(stats)) signals.push("specific_question");
  if (isLearningPrompt(stats.normalized)) signals.push("learning");
  if (hasClearContext(stats)) signals.push("clear_context");

  return signals;
}

function hasShowsAttempt(normalizedText: string): boolean {
  return HEALTHY_SIGNAL_PATTERNS.showsAttempt.test(normalizedText);
}

function hasSpecificQuestion(stats: TextStats): boolean {
  return stats.questionMarks > 0 && stats.wordCount >= 20 && stats.wordCount <= 250;
}

function isLearningPrompt(normalizedText: string): boolean {
  return HEALTHY_SIGNAL_PATTERNS.learning.test(normalizedText);
}

function hasClearContext(stats: TextStats): boolean {
  return stats.wordCount >= 20 && stats.wordCount <= 250 && !isContextWithoutQuestion(stats);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
      case "context_without_question":
        return `Count ${category.count}: Dropping a full case file with no actual question attached.`;
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
