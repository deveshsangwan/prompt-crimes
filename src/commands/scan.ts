import { allAdapters, createAdapter } from "../adapters";
import type { Message } from "../adapters";
import { analyzeMessages } from "../analyzer";
import { renderReport } from "../report";

interface ScanOptions {
  agent?: string;
  since?: Date;
  showSnippets: boolean;
}

function parseArgs(args: string[]): ScanOptions {
  const options: ScanOptions = { showSnippets: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--agent" || arg === "-a") {
      const value = args[++i];
      if (!value) throw new Error("--agent requires a value");
      options.agent = value;
    } else if (arg === "--since" || arg === "-s") {
      const value = args[++i];
      if (!value) throw new Error("--since requires a date");
      const since = new Date(value);
      if (Number.isNaN(since.getTime())) throw new Error(`invalid date: ${value}`);
      options.since = since;
    } else if (arg === "--show-snippets") {
      options.showSnippets = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`prompt-crimes scan - scan local AI chat histories

Options:
  --agent, -a <name>   Scan one agent (claude, codex, cursor, opencode, amp, cline, zed)
  --since, -s <date>   Only scan messages after this date (ISO 8601)
  --show-snippets      Include short sanitized excerpts for top evidence
  --help, -h           Show this help`);
      process.exit(0);
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  return options;
}

const SPINNER_MESSAGES = [
  "Subpoenaing vague asks",
  "Dusting stack traces for context",
  "Checking if 'thoughts?' is a felony",
  "Measuring dependency vibes",
  "Cross-examining context dumps",
  "Assembling the roast docket"
];

function createSpinner() {
  let timer: ReturnType<typeof setInterval> | null = null;
  let index = Math.floor(Math.random() * SPINNER_MESSAGES.length);
  let dots = 0;

  return {
    start() {
      if (process.env["NO_COLOR"] || !process.stderr.isTTY) return;
      timer = setInterval(() => {
        dots = (dots + 1) % 4;
        const message = SPINNER_MESSAGES[index % SPINNER_MESSAGES.length];
        process.stderr.write(`\r  \x1b[2m${message}${".".repeat(dots || 1)}\x1b[0m   `);
      }, 250);
    },
    update() {
      index++;
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      process.stderr.write(`\r${" ".repeat(72)}\r`);
    }
  };
}

export async function scan(args: string[]): Promise<void> {
  const options = parseArgs(args);
  const adapters = options.agent ? [createAdapter(options.agent)] : allAdapters();
  const messages: Message[] = [];

  const spinner = createSpinner();
  spinner.start();
  try {
    for (const adapter of adapters) {
      spinner.update();
      for await (const message of adapter.messages({ since: options.since })) {
        messages.push({ ...message, agent: adapter.name });
      }
    }
  } finally {
    spinner.stop();
  }

  const report = analyzeMessages(messages, { includeSnippets: options.showSnippets });
  console.log(renderReport(report, { showSnippets: options.showSnippets }));
}
