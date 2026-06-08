import { readFileSync } from "node:fs";
import { scan } from "./commands/scan";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8")
) as { version: string };

const VERSION = packageJson.version;

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  scan
};

function usage(): void {
  console.log(`prompt-crimes - roast your AI chat history, locally

Usage:
  prompt-crimes <command> [options]

Commands:
  scan          Scan local AI chat histories

Options:
  --help, -h    Show this help message
  --version     Show version

Examples:
  prompt-crimes
  prompt-crimes scan --agent codex
  prompt-crimes scan --since 2026-01-01
  prompt-crimes scan --show-snippets`);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const command = argv[0];

  if (command === "--help" || command === "-h") {
    usage();
    return;
  }

  if (command === "--version") {
    console.log(VERSION);
    return;
  }

  const handler = command ? COMMANDS[command] : undefined;
  if (handler) {
    await handler(argv.slice(1));
  } else {
    await scan(argv);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`prompt-crimes: ${message}`);
  process.exit(1);
});
