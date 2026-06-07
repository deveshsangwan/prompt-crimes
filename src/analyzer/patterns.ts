import type { CrimeCategory } from "./index";

export const CATEGORY_LABELS: Record<CrimeCategory, string> = {
  vague_prompt: "Vague Prompting",
  context_dump: "Context Dumping",
  context_without_question: "Context Without Question",
  validation_seeking: "Validation Seeking",
  decision_outsourcing: "Decision Outsourcing",
  error_dump_no_context: "Error Dump Without Context",
  prompt_ping_pong: "Prompt Ping-Pong"
};

export const CATEGORY_POINTS: Record<CrimeCategory, number> = {
  vague_prompt: 7,
  context_dump: 10,
  context_without_question: 9,
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
    /(error|exception|traceback|stack trace|^\s*at\s+\S+|^\s*caused by:|failed|enoent|typeerror|referenceerror|syntaxerror)/i,
  jsonLikeLineStart: /^\s*["'{[]/,
  jsonLikeLineEnd: /^\s*[\]}],?$/,
  logLevel: /\b(info|warn|error|debug|trace)\b/i,
  isoDate: /\d{4}-\d{2}-\d{2}/
} as const;

export const VAGUE_PROMPT_PATTERNS = {
  exactAsk:
    /^(fix|debug|review|improve|clean up|refactor|optimi[sz]e|explain|thoughts|check|help)\s*(this|it)?\??$/,
  exactShortPanic: /^(why|issue|problem|any idea|ideas|pls help|help pls|fix fast|urgent)\??$/,
  exactBrokenState: /^(not working|still not working|broken|failing|same issue)\.?$/,
  shortAction: /(fix|debug|improve|review|thoughts|help|better|broken|issue|problem|check)/,
  shortPhrase: /(make it better|do your thing|you know what to do|thoughts\??|any idea\??)/
} as const;

export const REASON_TEMPLATES: Record<CrimeCategory, readonly string[]> = {
  vague_prompt: [
    "asked for help with the precision of a smoke signal",
    "gave the model a mystery box and called it a requirement",
    "made the model do requirements gathering without consent"
  ],
  context_dump: [
    "big paste energy with a suspiciously tiny ask",
    "submitted a documentary and requested a tweet-sized answer",
    "released a context avalanche and called it collaboration"
  ],
  context_without_question: [
    "submitted evidence to the court but forgot the actual charge",
    "dropped a full case file with no actual question attached",
    "opened a support ticket made entirely of vibes and background reading"
  ],
  validation_seeking: [
    "asked the model to become a confidence vending machine",
    "used AI as emotional TypeScript",
    "requested a sanity check from a machine with no sanity"
  ],
  decision_outsourcing: [
    "outsourced taste, judgment, and possibly free will",
    "handed the steering wheel to autocomplete",
    "made the model your unpaid life/product manager"
  ],
  error_dump_no_context: [
    "delivered the stack trace and fled the scene",
    "mailed a stack trace with no return address",
    "sent the corpse but not the crime scene"
  ],
  prompt_ping_pong: [
    "follow-up contains less context than a fortune cookie",
    "debugged via emotionally loaded Morse code",
    "kept saying no like the model could read the previous disappointment"
  ]
} as const;

export const CONTEXT_DUMP_PATTERNS = {
  tinyAsk: /(fix|help|thoughts|why|what now|please advise|make sense)\??\s*$/
} as const;

export const CONTEXT_WITHOUT_QUESTION_PATTERNS = {
  askVerb: /(can you|please|help|explain|fix|review|suggest|tell me|what should|how should|why)/
} as const;

export const HEALTHY_SIGNAL_PATTERNS = {
  showsAttempt: /(i tried|i ran|i checked|i tested|i changed|i found|my approach|expected|actual)/,
  learning: /(explain|how does|why does|difference between|teach me|help me understand)/
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
  strongError:
    /(typeerror|referenceerror|syntaxerror|cannot read properties|cannot find module|enoent|econnrefused|exit code \d+)/i,
  contextClues:
    /(i ran|command|expected|actual|environment|node|pnpm|npm|yarn|python|version|after|before|when i|steps|repro|trying to|i changed|i installed|i updated|works locally|production|staging)/,
  contextWords: new Set([
    "expected",
    "actual",
    "because",
    "after",
    "before",
    "when",
    "command",
    "version",
    "repro",
    "pnpm",
    "npm",
    "yarn",
    "changed",
    "installed",
    "updated",
    "production",
    "staging"
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
