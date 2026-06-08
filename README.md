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

  messages scanned     224
  agents found          3
  sessions found        33
  charges filed         13
  crime rate            5.8%

  Crime Index          ███░░░░░░░░░░░░░░░░░  17/100
  verdict               Independent Operator
  case summary          Mostly clean record, but the evidence locker still has a few sticky notes.

  top crimes
    MAJOR   Context Dumping              6 (93 pts)
    MINOR   Validation Seeking           2 (20 pts)
    MINOR   Decision Outsourcing         1 (14 pts)

  by agent
    codex          7 charges in    92 messages (7.6%) most charges
    cursor         4 charges in    81 messages (4.9%)
    claude         2 charges in    12 messages (16.7%) highest rate

  charges
    - Context Dumping x6: Releasing a context avalanche and asking for a snow cone.
    - Validation Seeking x2: Asking the model to stamp APPROVED on vibes.
    - Decision Outsourcing x1: Handing the steering wheel to autocomplete and checking the seatbelt later.
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

## Development

```bash
git clone https://github.com/deveshsangwan/prompt-crimes.git
cd prompt-crimes
npm install
npm test
npm run typecheck
npm run build
node dist/cli.js
```

To inspect publish contents:

```bash
npm pack --dry-run
```

## Publishing

This repo includes a GitHub Actions workflow at
`.github/workflows/publish.yml`.

The workflow publishes to npm when a version tag is pushed:

```bash
npm version patch
git push origin main --tags
```

Before using the workflow, configure npm Trusted Publishing for this package:

- Package: `prompt-crimes`
- Provider: GitHub Actions
- Repository: `deveshsangwan/prompt-crimes`
- Workflow file: `publish.yml`

The workflow uses `npm publish --provenance`, so npm can attach provenance to
the published package.

## Credits

Inspired by [DevLove](https://github.com/SirTenzin/devlove) and
[DevRage](https://github.com/gricha/devrage). The adapter shape follows
DevLove's useful local-only chat reader architecture, with a new analyzer and
report layer built for Prompt Crimes.
