import { createHash } from "node:crypto";
import type { Policy, ToolRule } from "./policy";

export interface ProposedAction {
  tool: string;
  args: Record<string, unknown>;
  estCostUsd?: number;
  rationale: string;
}
export interface Decision {
  verdict: "allow" | "block";
  tool: string;
  reason: string;
  sensitivity?: ToolRule["sensitivity"];
}
export interface LedgerEntry {
  seq: number;
  ts: string;
  type: string;
  data: unknown;
  prevHash: string;
  hash: string;
}

const ZERO = "0x" + "0".repeat(64);

// In-request-path enforcement + a hash-chained, tamper-evident ledger.
// Each entry commits to the previous one, so any edit to history breaks the chain.
export class Guard {
  private rules: Map<string, ToolRule>;
  private budget: number;
  private spent = 0;
  ledger: LedgerEntry[] = [];
  private prev = ZERO;

  constructor(policy: Policy) {
    this.rules = new Map(policy.tools.map((t) => [t.tool, t]));
    this.budget = policy.budgetUsd;
  }

  private digest(seq: number, ts: string, type: string, data: unknown): string {
    return "0x" + createHash("sha256").update(this.prev + seq + ts + type + JSON.stringify(data)).digest("hex");
  }

  private append(type: string, data: unknown): LedgerEntry {
    const seq = this.ledger.length + 1;
    const ts = new Date().toISOString();
    const hash = this.digest(seq, ts, type, data);
    const entry: LedgerEntry = { seq, ts, type, data, prevHash: this.prev, hash };
    this.ledger.push(entry);
    this.prev = hash;
    return entry;
  }

  record(type: string, data: unknown): LedgerEntry {
    return this.append(type, data);
  }

  evaluate(a: ProposedAction): { decision: Decision; entry: LedgerEntry } {
    const rule = this.rules.get(a.tool);
    let verdict: "allow" | "block" = "allow";
    let reason = "Within policy";

    if (!rule) {
      verdict = "block";
      reason = `Unknown tool '${a.tool}' — not in the policy derived from the agent's code`;
    } else if (rule.sensitivity === "forbidden") {
      verdict = "block";
      reason = rule.reason;
    } else if (rule.sensitivity === "sensitive") {
      const cost = a.estCostUsd ?? 0;
      const remaining = this.budget - this.spent;
      if (cost > remaining) {
        verdict = "block";
        reason = `$${cost} exceeds remaining budget ($${remaining.toFixed(2)}) — requires human approval`;
      } else {
        this.spent += cost;
        reason = `Sensitive but within budget ($${cost} ≤ $${remaining.toFixed(2)} remaining)`;
      }
    }

    const decision: Decision = { verdict, tool: a.tool, reason, sensitivity: rule?.sensitivity };
    const entry = this.append(verdict === "allow" ? "action.allowed" : "action.blocked", {
      tool: a.tool,
      args: a.args,
      estCostUsd: a.estCostUsd ?? 0,
      rationale: a.rationale,
      decision: verdict,
      reason,
    });
    return { decision, entry };
  }

  get spentUsd(): number {
    return this.spent;
  }
  root(): string {
    return this.prev;
  }
  verifyIntegrity(): boolean {
    let prev = ZERO;
    for (const e of this.ledger) {
      const h = "0x" + createHash("sha256").update(prev + e.seq + e.ts + e.type + JSON.stringify(e.data)).digest("hex");
      if (h !== e.hash || e.prevHash !== prev) return false;
      prev = e.hash;
    }
    return true;
  }
}
