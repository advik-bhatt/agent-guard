import { execFile } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// The context engine — a symbol-aware "supercharged grep" that gives the
// verifier whole-repo context (which call sites a change actually affects).
// This is AgentWork's Perseus layer: it ships a real built-in engine and,
// when CONTEXT_PROVIDER=perseus + PERSEUS_CMD are set, routes to real Perseus.

export interface RepoFile {
  path: string;
  content: string;
}
export interface Reference {
  path: string;
  line: number;
  snippet: string;
}
export interface SymbolContext {
  symbol: string;
  refs: Reference[];
}
export interface VerificationContext {
  provider: "builtin" | "perseus";
  changedPath: string;
  changedSymbols: string[];
  diff: DiffLine[];
  callSites: SymbolContext[];
  filesScanned: number;
}
export interface DiffLine {
  kind: " " | "+" | "-";
  text: string;
}

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rb|java|rs|sol)$/;
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", "artifacts", "cache", ".next"]);

export function loadRepo(root: string): RepoFile[] {
  const out: RepoFile[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIR.has(name)) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (SOURCE_EXT.test(name) && st.size < 200_000) {
        out.push({ path: relative(root, full), content: readFileSync(full, "utf8") });
      }
    }
  };
  walk(root);
  return out;
}

// Exported function / const names declared in a source file.
export function exportedSymbols(content: string): string[] {
  const names = new Set<string>();
  const re = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) names.add(m[1]);
  return [...names];
}

// Find references to `symbol` across files (excluding its own definition file).
export function findReferences(files: RepoFile[], symbol: string, excludePath: string): Reference[] {
  const refs: Reference[] = [];
  const word = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  for (const f of files) {
    if (f.path === excludePath) continue;
    const lines = f.content.split("\n");
    lines.forEach((line, i) => {
      // Any reference is useful signal — imports show the dependency, call sites
      // show where a contract change would actually bite.
      if (word.test(line)) {
        refs.push({ path: f.path, line: i + 1, snippet: line.trim().slice(0, 200) });
      }
    });
  }
  return refs;
}

// Minimal LCS line diff for display + the verifier prompt.
export function lineDiff(oldStr: string, newStr: string): DiffLine[] {
  const a = oldStr.split("\n");
  const b = newStr.split("\n");
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: " ", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "-", text: a[i++] });
    } else {
      out.push({ kind: "+", text: b[j++] });
    }
  }
  while (i < n) out.push({ kind: "-", text: a[i++] });
  while (j < m) out.push({ kind: "+", text: b[j++] });
  return out;
}

// Optional real-Perseus adapter. Set CONTEXT_PROVIDER=perseus and PERSEUS_CMD to
// a command that takes "<symbol> <repoRoot>" and prints JSON [{path,line,snippet}].
async function perseusReferences(symbol: string, repoRoot: string): Promise<Reference[] | null> {
  const cmd = process.env.PERSEUS_CMD;
  if (process.env.CONTEXT_PROVIDER !== "perseus" || !cmd) return null;
  try {
    const [bin, ...args] = cmd.split(" ");
    const { stdout } = await execFileAsync(bin, [...args, symbol, repoRoot], { timeout: 10_000 });
    return JSON.parse(stdout) as Reference[];
  } catch {
    return null; // fall back to the built-in engine
  }
}

export async function getVerificationContext(opts: {
  repoRoot: string;
  changedPath: string;
  oldContent: string;
  newContent: string;
}): Promise<VerificationContext> {
  const files = loadRepo(opts.repoRoot);
  const changedSymbols = exportedSymbols(opts.oldContent);
  const diff = lineDiff(opts.oldContent, opts.newContent);

  let provider: "builtin" | "perseus" = "builtin";
  const callSites: SymbolContext[] = [];
  for (const symbol of changedSymbols) {
    const viaPerseus = await perseusReferences(symbol, opts.repoRoot);
    if (viaPerseus) provider = "perseus";
    const refs = viaPerseus ?? findReferences(files, symbol, opts.changedPath);
    if (refs.length) callSites.push({ symbol, refs });
  }

  return {
    provider,
    changedPath: opts.changedPath,
    changedSymbols,
    diff,
    callSites,
    filesScanned: files.length,
  };
}

// Render the context into a compact block for the verifier's prompt.
export function renderContextForPrompt(ctx: VerificationContext): string {
  const sites = ctx.callSites
    .map(
      (s) =>
        `Symbol \`${s.symbol}\` is used in:\n` +
        s.refs.map((r) => `  - ${r.path}:${r.line}  ${r.snippet}`).join("\n")
    )
    .join("\n\n");
  return `Repo-wide call-site context (${ctx.provider} engine, ${ctx.filesScanned} files scanned):\n${sites || "  (no external call sites found)"}`;
}
