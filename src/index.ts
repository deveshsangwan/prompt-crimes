export type { Adapter, AdapterOptions, Message } from "./adapters";
export { allAdapters, createAdapter } from "./adapters";
export { parseClaudeJsonl } from "./adapters/claude";
export { parseCodexJsonl } from "./adapters/codex";
export { parseCursorJsonl } from "./adapters/cursor";
export { opencodeAdapter } from "./adapters/opencode";
export type {
  CrimeCategory,
  CrimeEvidence,
  CrimeReport,
  CrimeSeverity,
  MessageMeta
} from "./analyzer";
export { analyzeMessages, analyzeText, getVerdict } from "./analyzer";
export { renderReport } from "./report";
