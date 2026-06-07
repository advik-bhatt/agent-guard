import { existsSync } from "node:fs";
import { join } from "node:path";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { config, llmProvider } from "./config";
import { derivePolicy } from "./policy";
import { Guard } from "./guard";
import { runAgent } from "./agentRunner";
import { getScenario } from "./scenario";
import { anchorRoot } from "./anchor";
import { getDb } from "./db";
import type { DemoEvent } from "./types";

const app = express();
app.use(cors());
app.use(express.json());

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, product: "AgentGuard", chainMode: config.chainMode, llm: llmProvider() });
});

// The AgentGuard demo: derive a policy from the agent's code, run the (injected)
// agent, enforce every tool call in-path, hash-chain the verdicts, anchor on-chain.
app.get("/api/guard/demo", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let closed = false;
  req.on("close", () => (closed = true));
  const send = (e: DemoEvent) => {
    if (!closed) res.write(`data: ${JSON.stringify(e)}\n\n`);
  };

  const s = getScenario();
  try {
    // 1) Derive least-privilege policy from the agent's codebase (Perseus layer)
    send({ step: "deriving", message: "Perseus scanning the agent's codebase to derive a least-privilege policy…" });
    const policy = await derivePolicy(s.repoRoot, s.agent, s.budgetUsd);
    const guard = new Guard(policy);
    guard.record("policy.derived", { agent: policy.agent, tools: policy.tools, budgetUsd: policy.budgetUsd });
    send({
      step: "policy",
      agent: policy.agent,
      sourceRepo: policy.sourceRepo.replace(process.cwd(), "."),
      derivedBy: policy.derivedBy,
      filesScanned: policy.filesScanned,
      budgetUsd: policy.budgetUsd,
      tools: policy.tools,
      llm: llmProvider(),
    });

    // 2) The task (with poisoned input)
    send({ step: "task", task: s.task, ticket: s.ticket });
    await wait(400);

    // 3) Run the agent — it ingests the injected ticket and proposes tool calls
    send({ step: "thinking", message: "Agent (AWS Bedrock) handling the ticket…" });
    const actions = await runAgent(policy, s.task, s.ticket);
    send({ step: "proposed", count: actions.length });
    await wait(300);

    // 4) Enforce every proposed action in the request path
    let allowed = 0;
    let blocked = 0;
    let blockedSpend = 0;
    for (const a of actions) {
      const { decision, entry } = guard.evaluate(a);
      if (decision.verdict === "allow") allowed++;
      else {
        blocked++;
        blockedSpend += a.estCostUsd ?? 0;
      }
      send({
        step: "decision",
        seq: entry.seq,
        tool: decision.tool,
        verdict: decision.verdict,
        sensitivity: decision.sensitivity ?? "unknown",
        reason: decision.reason,
        args: a.args,
        estCostUsd: a.estCostUsd ?? 0,
        rationale: a.rationale,
        hash: entry.hash,
        prevHash: entry.prevHash,
      });
      await wait(650);
    }

    send({
      step: "summary",
      allowed,
      blocked,
      blockedSpendUsd: blockedSpend,
      total: actions.length,
      integrity: guard.verifyIntegrity(),
    });

    // 5) Seal + anchor the ledger root on-chain (non-repudiation)
    const sealed = guard.record("ledger.sealed", { entries: guard.ledger.length });
    send({ step: "sealing", message: "Sealing the audit ledger and anchoring its root on-chain…" });
    const anchor = await anchorRoot(guard.root());
    send({
      step: "anchored",
      rootHash: guard.root(),
      txHash: anchor.txHash,
      explorerUrl: anchor.explorerUrl,
      simulated: anchor.simulated,
      entries: guard.ledger.length,
    });

    // 6) Persist (best-effort)
    try {
      const db = await getDb();
      const taskRow = await db.createTask({ description: s.task, bountyMnt: "0", status: "guarded", title: s.agent });
      for (const e of guard.ledger) {
        await db.addEvent({ taskId: taskRow.id, type: e.type, message: null, txHash: null, payload: e });
      }
      await db.addEvent({ taskId: taskRow.id, type: "ledger.anchored", txHash: anchor.txHash, simulated: anchor.simulated, payload: { root: guard.root() } });
    } catch (err) {
      console.warn("[db] persist failed:", (err as Error).message);
    }

    send({ step: "done", allowed, blocked, anchored: true });
  } catch (err) {
    console.error("[guard] error:", err);
    send({ step: "error", message: (err as Error).message });
  } finally {
    if (!closed) res.write("data: [DONE]\n\n");
    res.end();
  }
});

// Serve the built frontend (single-port deploy, e.g. Replit) when present.
const dist = join(process.cwd(), "frontend", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(join(dist, "index.html"));
  });
}

app.listen(config.port, "0.0.0.0", () => {
  console.log(`\n  AgentGuard → http://localhost:${config.port}`);
  console.log(`  agent runtime: ${llmProvider()}   chain: ${config.chainMode}`);
  console.log(`  frontend dev → http://localhost:5173\n`);
});
