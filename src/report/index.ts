import type { CategoryImpact, CrimeReport } from "../analyzer";

interface RenderOptions {
  showSnippets?: boolean;
}

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m"
};

function color(code: keyof typeof COLORS, value: string): string {
  if (process.env["NO_COLOR"]) return value;
  return `${COLORS[code]}${value}${COLORS.reset}`;
}

export function renderReport(report: CrimeReport, options: RenderOptions = {}): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`  ${color("bold", color("magenta", "PROMPT CRIMES REPORT"))}`);
  lines.push(`  ${color("dim", "--------------------")}`);
  lines.push("");
  lines.push(`  ${color("dim", "messages scanned")}     ${color("bold", String(report.totals.messages))}`);
  lines.push(`  ${color("dim", "agents found")}          ${color("bold", String(report.totals.agents))}`);
  lines.push(`  ${color("dim", "sessions found")}        ${color("bold", String(report.totals.sessions))}`);
  if (report.totals.dateRange) {
    lines.push(`  ${color("dim", "date range")}            ${report.totals.dateRange.from} -> ${report.totals.dateRange.to}`);
  }
  lines.push(`  ${color("dim", "charges filed")}         ${color("bold", String(report.totals.crimes))}`);
  lines.push(`  ${color("dim", "crime rate")}            ${color("bold", String(((report.totals.crimes / report.totals.messages) * 100).toFixed(1)).padStart(3))}%`);
  lines.push("");
  lines.push(`  ${color("bold", "Crime Index")}          ${indexBar(report.crimeIndex)} ${color("bold", String(report.crimeIndex).padStart(3))}/100`);
  lines.push(`  ${color("dim", "verdict")}               ${color(verdictColor(report.crimeIndex), report.verdict)}`);
  lines.push(`  ${color("dim", "case summary")}          ${report.caseSummary}`);

  if (report.categories.length > 0) {
    lines.push("");
    lines.push(`  ${color("bold", "top crimes")}`);
    for (const category of report.categories.slice(0, 8)) {
      lines.push(
        `    ${impactBadge(category.impact)} ${category.label.padEnd(28)} ${color("bold", String(category.count).padStart(4))} ${color("dim", `(${category.points} pts)`)}`
      );
      if (options.showSnippets) {
        for (const example of category.examples.filter((item) => item.snippet).slice(0, 2)) {
          lines.push(`       ${color("gray", example.reason)}: ${example.snippet}`);
        }
      }
    }
  }

  const agents = Object.entries(report.perAgent).sort(([, a], [, b]) => b.points - a.points);
  if (agents.length > 0) {
    const agentMarkers = getAgentMarkers(agents);
    lines.push("");
    lines.push(`  ${color("bold", "by agent")}`);
    for (const [agent, stats] of agents) {
      const rate = stats.messages === 0 ? "0.0" : ((stats.crimes / stats.messages) * 100).toFixed(1);
      const markers = agentMarkers.get(agent);
      const marker = markers && markers.length > 0 ? color("yellow", ` ${markers.join(", ")}`) : "";
      lines.push(
        `    ${color("cyan", agent.padEnd(10))} ${String(stats.crimes).padStart(4)} charges in ${String(stats.messages).padStart(5)} messages ${color("dim", `(${rate}%)`)}${marker}`
      );
    }
  }

  lines.push("");
  lines.push(`  ${color("bold", "charges")}`);
  for (const charge of report.charges) {
    lines.push(`    - ${charge}`);
  }

  lines.push("");
  if (!options.showSnippets) {
    lines.push(`  ${color("dim", "snippets hidden by default; rerun with --show-snippets to include sanitized excerpts")}`);
  }

  return lines.join("\n");
}

function indexBar(index: number): string {
  const width = 20;
  const filled = Math.round((index / 100) * width);
  const bar = `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
  return color(verdictColor(index), bar);
}

function verdictColor(index: number): keyof typeof COLORS {
  if (index >= 70) return "red";
  if (index >= 45) return "yellow";
  return "green";
}

function impactBadge(impact: CategoryImpact): string {
  if (impact === "major") return color("red", "MAJOR  ");
  if (impact === "notable") return color("yellow", "NOTABLE");
  return color("green", "MINOR  ");
}

function getAgentMarkers(agents: Array<[string, CrimeReport["perAgent"][string]]>): Map<string, string[]> {
  const markers = new Map<string, string[]>();
  const activeAgents = agents.filter(([, stats]) => stats.crimes > 0 && stats.messages > 0);
  if (activeAgents.length < 2) return markers;

  const mostCharges = uniqueMax(activeAgents, ([, stats]) => stats.crimes);
  const highestRate = uniqueMax(activeAgents, ([, stats]) => stats.crimes / stats.messages);

  if (mostCharges) markers.set(mostCharges[0], ["most charges"]);
  if (highestRate) {
    const existing = markers.get(highestRate[0]) ?? [];
    existing.push("highest rate");
    markers.set(highestRate[0], existing);
  }

  return markers;
}

function uniqueMax<T>(items: T[], score: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  let tied = false;

  for (const item of items) {
    const itemScore = score(item);
    if (itemScore > bestScore) {
      best = item;
      bestScore = itemScore;
      tied = false;
    } else if (itemScore === bestScore) {
      tied = true;
    }
  }

  return tied ? undefined : best;
}
