# Prompt Crimes

Generate a funny local roast report from your AI chat history.

`prompt-crimes` scans local chat/session storage for common prompting habits:
vague asks, context dumps, validation seeking, decision outsourcing, stack
traces without context, and tiny retry prompts like `again` or `still broken`.

Everything runs locally. No chat content is sent anywhere.

## Install

```bash
npm install
npm run build
node dist/cli.js
```

Once published:

```bash
npx prompt-crimes
```

## Usage

```bash
prompt-crimes
prompt-crimes scan
prompt-crimes scan --agent codex
prompt-crimes scan --since 2026-01-01
prompt-crimes scan --show-snippets
```

Snippets are hidden by default so the report is safer to share. Use
`--show-snippets` to include short sanitized excerpts for the top evidence.

## Supported Agents

- Claude Code
- Codex
- Cursor
- OpenCode
- Amp
- Cline / Roo Code
- Zed

## Development

```bash
npm run build
npm test
npm run typecheck
```

## Credits

Inspired by DevLove and DevRage. The adapter shape follows DevLove's useful
local-only chat reader architecture, with a new analyzer and report layer built
for Prompt Crimes.
