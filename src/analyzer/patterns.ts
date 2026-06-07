import type { CrimeCategory } from "./index";

export const CATEGORY_LABELS: Record<CrimeCategory, string> = {
  vague_prompt: "Vague Prompting",
  context_dump: "Context Dumping",
  validation_seeking: "Validation Seeking",
  decision_outsourcing: "Decision Outsourcing",
  error_dump_no_context: "Error Dump Without Context",
  prompt_ping_pong: "Prompt Ping-Pong"
};

export const CATEGORY_POINTS: Record<CrimeCategory, number> = {
  vague_prompt: 7,
  context_dump: 10,
  validation_seeking: 8,
  decision_outsourcing: 11,
  error_dump_no_context: 12,
  prompt_ping_pong: 9
};

export const TEXT_PATTERNS = {
  codeBlock: /```[\s\S]*?```/g,
  lineBreak: /\r?\n/,
  questionMark: /\?/g,
  whitespace: /\s+/g,
  word: /[a-z0-9_'-]+/g,
  codeLine:
    /^\s*(import |export |const |let |var |function |class |if \(|for \(|while \(|return |def |public |private |<\/?[a-z][^>]*>|[{}`];?$)/i,
  errorLine:
    /(error|exception|traceback|stack trace|^\s*at\s+\S+|^\s*caused by:|failed|enoent|typeerror|referenceerror|syntaxerror)/i
} as const;

export const VAGUE_PROMPT_PATTERNS = {
  exactAsk: /^(fix|debug|review|improve|clean up|refactor|optimi[sz]e|explain|thoughts)\s*(this|it)?\??$/,
  shortAction: /(fix|debug|improve|review|thoughts|help|better|broken)/,
  shortPhrase: /(make it better|do your thing|you know what to do|thoughts\??)/
} as const;

export const CONTEXT_DUMP_PATTERNS = {
  tinyAsk: /(fix|help|thoughts|why|what now|please advise|make sense)\??\s*$/
} as const;

export const VALIDATION_SEEKING_PATTERNS = [
  /is this (okay|ok|right|correct|good|fine)/,
  /am i (right|wrong|crazy|missing something)/,
  /does this make sense/,
  /do you agree/,
  /sanity check/,
  /validate (this|my thinking|my approach)/,
  /tell me i'm not/
] as const;

export const DECISION_OUTSOURCING_PATTERNS = [
  /you decide/,
  /pick (the )?(best|one|option|approach)/,
  /which (one|approach|option|library|framework|model) should i use/,
  /what should i do/,
  /make the decision/,
  /choose for me/,
  /whatever you think is best/
] as const;

export const ERROR_DUMP_PATTERNS = {
  contextClues:
    /(i ran|command|expected|actual|environment|node|python|version|after|before|when i|steps|repro|trying to)/,
  contextWords: new Set([
    "expected",
    "actual",
    "because",
    "after",
    "before",
    "when",
    "command",
    "version",
    "repro"
  ])
} as const;

export const PING_PONG_PATTERNS = {
  exact:
    /^(no|nope|again|still broken|try again|wrong|nah|continue|go on|fix it|not that|doesn't work|didn't work|same error)\.?$/,
  keyword: /(again|wrong|broken|continue|nope|nah)/
} as const;

export const SNIPPET_SANITIZERS = [
  { pattern: TEXT_PATTERNS.codeBlock, replacement: "[code block]" },
  { pattern: /(?:[A-Z]:)?[/.~][^\s]+/g, replacement: "[path]" },
  { pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, replacement: "[email]" },
  { pattern: /\b(?:sk|pk|ghp|gho|ghu|ghs|xoxb|xoxp)_[A-Za-z0-9_=-]{8,}\b/g, replacement: "[secret]" },
  { pattern: TEXT_PATTERNS.whitespace, replacement: " " }
] as const;
