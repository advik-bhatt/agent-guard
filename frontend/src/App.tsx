import { useEffect, useRef, useState } from "react";
import { AgentIdentity } from "./components/AgentIdentity";
import { TaskPanel } from "./components/TaskPanel";
import { AgentStream } from "./components/AgentStream";
import { ChainProof } from "./components/ChainProof";
import { BACKEND, fetchTasks, streamDemo } from "./api";
import type { Identity, LogEntry, Reputation, Status, TaskMeta, Tx, Verdict, WorkerResult } from "./types";

export default function App() {
  const [tasks, setTasks] = useState<TaskMeta[]>([]);
  const [selected, setSelected] = useState<string>("strategy");
  const [running, setRunning] = useState(false);

  const [identity, setIdentity] = useState<Identity>();
  const [title, setTitle] = useState<string>();
  const [description, setDescription] = useState<string>();
  const [bounty, setBounty] = useState("0.05");
  const [status, setStatus] = useState<Status>("Idle");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [payment, setPayment] = useState<{ amount: string; url: string; simulated: boolean }>();
  const [reputationUpdated, setReputationUpdated] = useState(false);
  const [reputation, setReputation] = useState<Reputation>();
  const [error, setError] = useState<string>();
  const [health, setHealth] = useState<{ chainMode: string; llm: string }>();

  const idRef = useRef(0);
  const stopRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    fetchTasks()
      .then((t) => {
        setTasks(t);
        if (t[0]) setSelected(t[0].id);
      })
      .catch(() => setError("Could not reach the backend. Start it with `npm run dev`."));
    fetch(`${BACKEND}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
    return () => stopRef.current?.();
  }, []);

  const pushLog = (entry: Omit<LogEntry, "id">) =>
    setLog((prev) => [...prev, { id: idRef.current++, ...entry }]);
  const addTx = (label: string, e: any) =>
    setTxs((prev) => [...prev, { label, hash: e.txHash, url: e.explorerUrl, simulated: !!e.simulated }]);

  function onEvent(e: any) {
    switch (e.step as string) {
      case "identity":
        setIdentity(e as Identity);
        setBounty(e.bounty);
        break;
      case "task":
        setTitle(e.title);
        setDescription(e.description);
        setStatus("Idle");
        break;
      case "posting":
        pushLog({ kind: "chain", text: e.message });
        break;
      case "posted":
        setStatus("Open");
        addTx("Task Posted", e);
        pushLog({ kind: "chain", text: `Task #${e.taskId} posted · bounty ${e.bounty}` });
        break;
      case "claiming":
        pushLog({ kind: "agent", text: e.message });
        break;
      case "claimed":
        setStatus("Claimed");
        addTx("Task Claimed", e);
        pushLog({ kind: "chain", text: "ERC-8004 identity verified — task claimed" });
        break;
      case "working":
        pushLog({ kind: "agent", text: e.message });
        break;
      case "worker_result":
        pushLog({ kind: "worker", worker: e as WorkerResult });
        break;
      case "submitting":
        pushLog({ kind: "agent", text: e.message });
        break;
      case "submitted":
        setStatus("Submitted");
        addTx("Work Submitted", e);
        pushLog({ kind: "chain", text: "Work submitted on-chain" });
        break;
      case "verifying":
        pushLog({ kind: "agent", text: e.message });
        break;
      case "verdict":
        pushLog({ kind: "verdict", verdict: e as Verdict });
        break;
      case "paying":
        pushLog({ kind: "pay", text: e.message });
        break;
      case "paid":
        setStatus("Completed");
        setPayment({ amount: e.amount, url: e.explorerUrl, simulated: !!e.simulated });
        addTx("Payment Released", e);
        pushLog({ kind: "pay", text: `Released ${e.amount} to the worker wallet` });
        break;
      case "held":
        setStatus("Failed");
        pushLog({ kind: "chain", text: e.message });
        break;
      case "reputation":
        pushLog({ kind: "chain", text: e.message });
        break;
      case "reputation_updated":
        setReputationUpdated(true);
        addTx("Reputation Updated", e);
        break;
      case "reputation_summary":
        setReputation({ count: e.count, avgScore: e.avgScore });
        break;
      case "error":
        setError(e.message);
        pushLog({ kind: "error", text: e.message });
        break;
    }
  }

  function run() {
    setRunning(true);
    setError(undefined);
    setLog([]);
    setTxs([]);
    setPayment(undefined);
    setReputationUpdated(false);
    setReputation(undefined);
    setStatus("Idle");
    setIdentity(undefined);
    idRef.current = 0;
    stopRef.current = streamDemo(selected, {
      onEvent,
      onDone: () => setRunning(false),
      onError: (m) => {
        setError(m);
        setRunning(false);
      },
    });
  }

  const chainMode = identity?.chainMode ?? health?.chainMode;
  const llm = identity?.llm ?? health?.llm;

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-top">
          <div className="brand">
            <div className="logo">◇</div>
            <div>
              <h1>AgentWork</h1>
              <p className="tagline">Trustless AI payroll &amp; on-chain reputation · Mantle ERC-8004</p>
            </div>
          </div>
          <div className="sponsors">
            <span className="pill">Mantle · ERC-8004</span>
            <span className="pill">AWS Bedrock</span>
            <span className="pill">Replit</span>
          </div>
        </div>

        <p className="pitch">
          Every company will employ AI agents. Nobody has solved how to <b>pay them</b> or{" "}
          <b>verify their work</b> without a human in the loop. AgentWork does: work gets done, a
          second AI grades it, and payment + reputation settle on-chain — zero humans.
        </p>

        <div className="controls">
          <select
            className="task-select"
            value={selected}
            disabled={running || tasks.length === 0}
            onChange={(e) => setSelected(e.target.value)}
          >
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.expectPass ? "✓" : "⚠"} {t.title}
              </option>
            ))}
          </select>
          <button className="run-btn" onClick={run} disabled={running || tasks.length === 0}>
            {running ? <span className="spinner" /> : "▶"} {running ? "Running…" : "Run Demo"}
          </button>
          {(chainMode || llm) && (
            <div className="mode-tags">
              {chainMode && (
                <span className={`mode ${chainMode === "live" ? "mode-live" : ""}`}>
                  chain: {chainMode}
                </span>
              )}
              {llm && <span className="mode">agents: {llm}</span>}
            </div>
          )}
        </div>

        {error && <div className="error-banner">⚠ {error}</div>}
        {chainMode === "simulation" && (
          <div className="note">
            Simulation mode — the full flow runs with realistic (sim) tx hashes so the demo never
            depends on a faucet. Set <code>CHAIN_MODE=live</code> to move real MNT on Mantle Sepolia.
          </div>
        )}
      </header>

      <main className="grid">
        <AgentIdentity identity={identity} reputation={reputation} />
        <TaskPanel title={title} description={description} bounty={bounty} status={status} />
        <AgentStream log={log} running={running} />
        <ChainProof txs={txs} payment={payment} reputationUpdated={reputationUpdated} />
      </main>

      <footer className="foot muted">
        AgentWork · the settlement &amp; reputation layer for the agent economy · built on Mantle,
        AWS &amp; Replit
      </footer>
    </div>
  );
}
