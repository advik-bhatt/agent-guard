import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
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

const FORBIDDEN = /(exec|shell|spawn|eval|rm_|delete|drop|wipe|destroy|env|secret|credential|password|exfil|ssh|key)/i;
const SENSITIVE = /(payment|pay_|wire|transfer|refund|charge|email|send|sms|http|fetch|post_|upload|webhook)/i;

function classify(name: string): ToolRule {
  if (FORBIDDEN.test(name))
    return { tool: name, sensitivity: "forbidden", reason: "Code execution / secrets / destructive — never allowed autonomously" };
  if (SENSITIVE.test(name))
    return { tool: name, sensitivity: "sensitive", reason: "Moves money or has external side effects — budget-gated, needs approval over cap" };
  return { tool: name, sensitivity: "safe", reason: "Read-only / informational" };
}

// Real Perseus pass: Perseus (the live code-context engine) renders the agent's
// tool source via the @read directive in .perseus/context.md. We classify that
// rendered context into a policy. Falls back to a direct scan if Perseus isn't
// installed/enabled so the demo always runs.
async function perseusRender(repoRoot: string): Promise<string> {
  if (process.env.PERSEUS_ENABLED !== "true") return "";
  try {
    const ctx = join(repoRoot, ".perseus", "context.md");
    const { stdout } = await execFileAsync("perseus", ["render", ctx], { cwd: repoRoot, timeout: 12000 });
    return stdout;
  } catch {
    return "";
  }
}

export async function derivePolicy(repoRoot: string, agent: string, budgetUsd: number): Promise<Policy> {
  const files = loadRepo(repoRoot);

  let derivedBy: "perseus" | "builtin" = "builtin";
  let sourceText = "";
  const rendered = await perseusRender(repoRoot);
  if (rendered && /export\s+(?:async\s+)?function/.test(rendered)) {
    sourceText = rendered; // Perseus actually surfaced the code
    derivedBy = "perseus";
  }
  if (!sourceText) {
    const toolFile = files.find((f) => /tools?\.(ts|js|py)$/i.test(f.path)) ?? files[0];
    sourceText = toolFile?.content ?? "";
  }

  const names = exportedSymbols(sourceText);
  return { agent, sourceRepo: repoRoot, derivedBy, tools: names.map(classify), budgetUsd, filesScanned: files.length };
}
