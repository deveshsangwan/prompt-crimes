import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const CLI = new URL("../dist/cli.js", import.meta.url).pathname;

test("prints help", () => {
  const result = spawnSync(process.execPath, [CLI, "--help"], { encoding: "utf-8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /prompt-crimes/);
});

test("rejects invalid date", () => {
  const result = spawnSync(process.execPath, [CLI, "scan", "--since", "not-a-date"], {
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid date/);
});

test("rejects invalid agent", () => {
  const result = spawnSync(process.execPath, [CLI, "scan", "--agent", "nope"], {
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown agent/);
});
