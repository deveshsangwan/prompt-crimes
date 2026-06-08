# Prompt Crimes

Generate a funny local "Prompt Crimes" report from your AI chat history.

`prompt-crimes` scans local AI chat/session storage and roasts common prompting
habits: vague asks, context dumps, validation seeking, decision outsourcing,
error dumps without context, and tiny retry prompts like `again` or
`still broken`.

Everything runs locally. No chat content is uploaded anywhere.

## Quick Start

Run without installing:

```bash
npx prompt-crimes
```

Or install globally:

```bash
npm install -g prompt-crimes
prompt-crimes
```

## Usage

```bash
prompt-crimes
prompt-crimes scan
prompt-crimes scan --agent codex
prompt-crimes scan --since 2026-01-01
prompt-crimes scan --show-snippets
```

By default, snippets are hidden so the report is safer to share. Use
`--show-snippets` to include short sanitized excerpts for the top evidence.

## Example Output

```txt
  PROMPT CRIMES REPORT
  --------------------

  messages scanned     489
  agents found          3
  sessions found        134
  date range            2025-10-12 -> 2026-06-08
  charges filed         23
  crime rate            4.7%

  Crime Index          ████░░░░░░░░░░░░░░░░  18/100
  verdict               Mostly Harmless Prompt Tourist
  case summary          Context Dumping made a cameo, then politely returned to misdemeanor court.

  top crimes
    MAJOR   Context Dumping                 9 (144 pts)
    NOTABLE Context Without Question        8 (88 pts)
    MINOR   Vague Prompting                 3 (23 pts)
    MINOR   Validation Seeking              2 (20 pts)
    MINOR   Error Dump Without Context      1 (15 pts)

  by agent
    cursor       13 charges in   352 messages (3.7%) most charges
    codex         5 charges in    93 messages (5.4%)
    opencode      5 charges in    44 messages (11.4%) highest rate

  charges
    - Context Dumping x9: Releasing a context avalanche and asking for a snow cone.
    - Context Without Question x8: Dropping a full case file with the final page missing.
    - Vague Prompting x3: Filing tickets with the acceptance criteria of a shrug.
    - Validation Seeking x2: Asking the model to stamp APPROVED on vibes.
    - Error Dump Without Context x1: Mailing a stack trace with no return address.
```

## Supported Agents

Reads local session storage for:

- Claude Code
- Codex
- Cursor
- OpenCode
- Amp
- Cline / Roo Code
- Zed

## Privacy

`prompt-crimes` is local-only. It reads chat history from local app storage,
analyzes it with deterministic heuristics, and prints a terminal report. It
does not call an LLM or send chat content to a server.

## Credits

Inspired by [DevLove](https://github.com/SirTenzin/devlove) and
[DevRage](https://github.com/gricha/devrage). The adapter shape follows
DevLove's useful local-only chat reader architecture, with a new analyzer and
report layer built for Prompt Crimes.
