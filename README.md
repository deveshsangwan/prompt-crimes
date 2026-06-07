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
  total charges         13

  AI Dependency Index  ███░░░░░░░░░░░░░░░░░  17/100
  verdict               Independent Operator

  top crimes
    HIGH Context Dumping                 6 (93 pts)
    MED  Validation Seeking              2 (20 pts)
    MED  Decision Outsourcing            1 (14 pts)

  charges
    - Context Dumping x6: Releasing a context avalanche and calling it collaboration.
    - Validation Seeking x2: Using the model as a tiny approval desk.
    - Decision Outsourcing x1: Handing the steering wheel to autocomplete.
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
