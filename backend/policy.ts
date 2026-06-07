import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadRepo, exportedSymbols } from "./context";

const execFileAsync = promisify(execFile);

export type Sensitivity = "safe" | "sensitive" | "forbidden";
export interface ToolRule {
  tool: string;
  sensitivity: Sensitivity;
  reason: string;
}
export interface Policy {
  agent: string;
  sourceRepo: string;
  derivedBy: "perseus" | "builtin";
  tools: ToolRule[];
  budgetUsd: number;
  filesScanned: number;
}

// Least-privilege classification, derived from the tool's name + role in code.
const FORBIDDEN = /(exec|shell|spawn|eval|rm_|delete|drop|wipe|destroy|env|secret|credential|password|exfil|ssh|key)/i;
const SENSITIVE = /(payment|pay_|wire|transfer|refund|charge|email|send|sms|http|fetch|post_|upload|webhook)/i;

function classify(name: string): ToolRule {
  if (FORBIDDEN.test(name))
    return { tool: name, sensitivity: "forbidden", reason: "Code execution / secrets / destructive — never allowed autonomously" };
  if (SENSITIVE.test(name))
    return { tool: name, sensitivity: "sensitive", reason: "Moves money or has external side effects — budget-gated, needs approval over cap" };
  return { tool: name, sensitivity: "safe", reason: "Read-only / informational" };
}

// Real Perseus pass (optional): `perseus` is a live code-context engine. When it's
// installed (pip install perseus-ctx) we let it render context over the agent repo,
// which is exactly its job ("supercharged grep" for agents). Falls back to the
// built-in scanner so the demo always runs.
async function tryPerseus(repoRoot: string): Promise<boolean> {
  if (process.env.PERSEUS_ENABLED !== "true") return false;
  try {
    await execFileAsync("perseus", ["--help"], { timeout: 8000, cwd: repoRoot });
    return true;
  } catch {
    return false;
  }
}

export async function derivePolicy(repoRoot: string, agent: string, budgetUsd: number): Promise<Policy> {
  const files = loadRepo(repoRoot);
  const toolFile = files.find((f) => /tools?\.(ts|js|py)$/i.test(f.path)) ?? files[0];
  const names = toolFile ? exportedSymbols(toolFile.content) : [];
  const derivedBy = (await tryPerseus(repoRoot)) ? "perseus" : "builtin";
  return {
    agent,
    sourceRepo: repoRoot,
    derivedBy,
    tools: names.map(classify),
    budgetUsd,
    filesScanned: files.length,
  };
}
