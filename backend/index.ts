import express, { type Request, type Response } from "express";
import cors from "cors";
import { config, llmProvider } from "./config";
import { getChain } from "./chain";
import { runWorker } from "./workerAgent";
import { runVerifier } from "./verifierAgent";
import { DEMO_TASKS, getTask } from "./demoTasks";
import type { DemoEvent } from "./types";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ service: "agentwork-backend", status: "ok", chainMode: config.chainMode, llm: llmProvider() });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, chainMode: config.chainMode, llm: llmProvider() });
});

app.get("/api/tasks", (_req, res) => {
  res.json(
    DEMO_TASKS.map((t) => ({ id: t.id, title: t.title, description: t.description, expectPass: t.expectPass }))
  );
});

app.get("/api/reputation/:agentId", async (req, res) => {
  try {
    const summary = await getChain().getReputation(req.params.agentId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Server-Sent Events: runs the full demo end-to-end and streams each step. */
app.get("/api/demo", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const send = (event: DemoEvent) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const chain = getChain();
  const info = chain.info();
  const task = getTask(typeof req.query.task === "string" ? req.query.task : undefined);

  try {
    send({
      step: "identity",
      chainMode: info.mode,
      llm: llmProvider(),
      workerModel: config.workerModel,
      verifierModel: config.verifierModel,
      bounty: config.bountyMnt,
      threshold: config.threshold,
      workerAgentId: info.workerAgentId,
      verifierAgentId: info.verifierAgentId,
      workerWallet: info.workerWallet,
      identityRegistry: info.identityRegistry,
      reputationRegistry: info.reputationRegistry,
      contract: info.contract,
    });

    send({ step: "task", id: task.id, title: task.title, description: task.description, bounty: config.bountyMnt });

    // 1. Post task (escrow MNT)
    send({ step: "posting", message: "Posting task to Mantle — escrowing bounty…" });
    const posted = await chain.postTask(task.description, config.bountyMnt);
    send({
      step: "posted",
      taskId: posted.taskId,
      txHash: posted.txHash,
      explorerUrl: posted.explorerUrl,
      bounty: `${config.bountyMnt} MNT`,
      simulated: posted.simulated,
    });

    // 2. Claim (ERC-8004 identity gate)
    send({ step: "claiming", message: `Worker agent #${info.workerAgentId} claiming task (ERC-8004 identity check)…` });
    const claimed = await chain.claimTask(posted.taskId, info.workerAgentId);
    send({ step: "claimed", txHash: claimed.txHash, explorerUrl: claimed.explorerUrl, simulated: claimed.simulated });

    // 3. Worker executes
    send({ step: "working", message: "Worker agent executing the task…" });
    const work = await runWorker(task);
    send({
      step: "worker_result",
      result: work.result,
      methodology: work.methodology,
      confidence: work.confidence,
    });

    // 4. Submit on-chain
    send({ step: "submitting", message: "Submitting work to the contract…" });
    const submitted = await chain.submitWork(posted.taskId, work.result.slice(0, 4000));
    send({ step: "submitted", txHash: submitted.txHash, explorerUrl: submitted.explorerUrl, simulated: submitted.simulated });

    // 5. Verifier grades
    send({ step: "verifying", message: `Verifier agent #${info.verifierAgentId} grading the output…` });
    const verdict = await runVerifier(task, work);
    send({
      step: "verdict",
      score: verdict.score,
      reasoning: verdict.reasoning,
      strengths: verdict.strengths,
      weaknesses: verdict.weaknesses,
      approved: verdict.approved,
      threshold: config.threshold,
    });

    // 6. Settle: pay (iff approved) + write reputation, in one verdict tx
    const settle = await chain.verifyAndPay(posted.taskId, verdict.approved, verdict.score, info.workerAgentId);

    if (settle.paid) {
      send({ step: "paying", message: "Score cleared the bar — releasing escrowed MNT to the worker…" });
      send({
        step: "paid",
        txHash: settle.txHash,
        amount: `${settle.amount} MNT`,
        explorerUrl: settle.explorerUrl,
        simulated: settle.simulated,
      });
    } else {
      send({
        step: "held",
        message: "Score below threshold — bounty stays in escrow. No payment.",
      });
    }

    // Reputation was written in the same verdict tx (best-effort on-chain).
    send({ step: "reputation", message: "Writing the verdict to the ERC-8004 Reputation Registry…" });
    send({
      step: "reputation_updated",
      agentId: info.workerAgentId,
      score: verdict.score,
      txHash: settle.txHash,
      explorerUrl: settle.explorerUrl,
      simulated: settle.simulated,
    });

    const summary = await chain.getReputation(info.workerAgentId);
    send({
      step: "reputation_summary",
      agentId: info.workerAgentId,
      count: summary.count,
      avgScore: summary.avgScore,
    });

    send({ step: "done", approved: settle.paid });
  } catch (err) {
    console.error("[demo] error:", err);
    send({ step: "error", message: (err as Error).message || "Unknown error" });
  } finally {
    if (!closed) res.write("data: [DONE]\n\n");
    res.end();
  }
});

app.listen(config.port, () => {
  console.log(`\n  AgentWork backend → http://localhost:${config.port}`);
  console.log(`  chain: ${config.chainMode}   agents: ${llmProvider()} (${config.workerModel})`);
  console.log(`  open the frontend → http://localhost:5173\n`);
});
