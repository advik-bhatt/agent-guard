import { useEffect, useRef, useState } from "react";
import { BACKEND, EXPLORER, streamGuard } from "./api";

interface ToolRule { tool: string; sensitivity: "safe" | "sensitive" | "forbidden"; reason: string; }
interface Policy {
  agent: string; sourceRepo: string; derivedBy: "perseus" | "builtin";
  filesScanned: number; budgetUsd: number; tools: ToolRule[]; llm: string;
}
interface Decision {
  seq: number; tool: string; verdict: "allow" | "block";
  sensitivity: string; reason: string; args: Record<string, unknown>;
  estCostUsd: number; rationale: string; hash: string; prevHash: string;
}
interface Summary { allowed: number; blocked: number; blockedSpendUsd: number; total: number; integrity: boolean; }
interface Anchor { rootHash: string; txHash: string; explorerUrl: string; simulated: boolean; entries: number; }

const short = (h: string) => (h && h.startsWith("0x") && h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);

export default function App() {
  const [running, setRunning] = useState(false);
  const [policy, setPolicy] = useState<Policy>();
  const [task, setTask] = useState<{ task: string; ticket: string }>();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [summary, setSummary] = useState<Summary>();
  const [anchor, setAnchor] = useState<Anchor>();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [health, setHealth] = useState<{ chainMode: string; llm: string }>();
  const stop = useRef<null | (() => void)>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/health`).then((r) => r.json()).then(setHealth).catch(() => {});
    return () => stop.current?.();
  }, []);
  useEffect(() => { feedRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [decisions]);

  function onEvent(e: any) {
    switch (e.step) {
      case "deriving": case "thinking": case "proposed": case "sealing": setStatus(e.message ?? null); break;
      case "policy": setPolicy(e as Policy); break;
      case "task": setTask({ task: e.task, ticket: e.ticket }); break;
      case "decision": setDecisions((p) => [...p, e as Decision]); break;
      case "summary": setSummary(e as Summary); setStatus(undefined); break;
      case "anchored": setAnchor(e as Anchor); break;
      case "error": setError(e.message); break;
    }
  }

  function run() {
    setRunning(true); setError(undefined); setPolicy(undefined); setTask(undefined);
    setDecisions([]); setSummary(undefined); setAnchor(undefined); setStatus(undefined);
    stop.current = streamGuard({
      onEvent,
      onDone: () => { setRunning(false); setStatus(undefined); },
      onError: (m) => { setError(m); setRunning(false); },
    });
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-top">
          <div className="brand">
            <div className="logo">🛡</div>
            <div>
              <h1>AgentGuard</h1>
              <p className="tagline">The firewall &amp; flight recorder for AI agents</p>
            </div>
          </div>
          <div className="sponsors">
            <span className="pill pill-live">live</span>
            <span className="pill">Claude</span>
            <span className="pill">On-chain audit</span>
          </div>
        </div>

        <p className="pitch">
          Companies are deploying autonomous agents that can spend money, run code, and touch
          production, and <b>88% have already hit an agent incident</b>. AgentGuard reads the agent's
          <b> own code</b> to derive a least-privilege policy, <b>blocks unsafe tool calls in the
          request path</b> before they run, and writes a <b>tamper-proof, on-chain-anchored</b> audit
          trail that cannot be quietly rewritten.
        </p>

        <div className="controls">
          <button className="run-btn" onClick={run} disabled={running}>
            {running ? <span className="spinner" /> : "▶"} {running ? "Running…" : "Run live attack"}
          </button>
          {(health || policy) && (
            <div className="mode-tags">
              <span className="mode">agent: {policy?.llm ?? health?.llm}</span>
              <span className="mode">chain: {health?.chainMode}</span>
            </div>
          )}
          {status && <span className="status-line">{status}</span>}
        </div>
        {error && <div className="error-banner">⚠ {error}</div>}
      </header>

      <main className="guard-grid">
        {/* LEFT: policy + ledger */}
        <div className="col">
          <section className="card">
            <div className="card-title">
              <span>Agent &amp; derived policy</span>
              {policy && <span className={`badge ${policy.derivedBy === "perseus" ? "badge-mantle" : "badge-amber"}`}>{policy.derivedBy === "perseus" ? "Perseus" : "built-in"} engine</span>}
            </div>
            <div className="identity-id">{policy?.agent ?? "—"}</div>
            <div className="identity-wallet muted">
              {policy ? `${policy.sourceRepo} · ${policy.filesScanned} files · budget $${policy.budgetUsd}` : "policy derived from the agent's source"}
            </div>
            <div className="tool-list">
              {(policy?.tools ?? []).map((t) => (
                <div key={t.tool} className="tool-row">
                  <span className={`sev sev-${t.sensitivity}`}>{t.sensitivity}</span>
                  <span className="tool-name">{t.tool}</span>
                </div>
              ))}
              {!policy && <div className="muted">Run the demo to derive the policy.</div>}
            </div>
          </section>

          <section className="card">
            <div className="card-title">
              <span>Tamper-proof ledger</span>
              {summary && <span className={`badge ${summary.integrity ? "badge-green" : "badge-live"}`}>{summary.integrity ? "integrity ✓" : "broken"}</span>}
            </div>
            <div className="ledger">
              {decisions.length === 0 && <div className="muted">Each verdict is hash-chained to the last.</div>}
              {decisions.map((d) => (
                <div key={d.seq} className="ledger-row">
                  <span className="muted">#{d.seq}</span>
                  <span className={d.verdict === "allow" ? "ok" : "bad"}>{d.verdict === "allow" ? "✓" : "✗"}</span>
                  <span className="hashmono">{short(d.hash)}</span>
                </div>
              ))}
            </div>
            {anchor && (
              <div className="anchor">
                <div className="payment-dot" />
                <div>
                  <div className="anchor-title">Anchored on-chain {anchor.simulated && <span className="tx-sim">sim</span>}</div>
                  <a className="hashmono" href={anchor.explorerUrl} target="_blank" rel="noreferrer">{short(anchor.txHash)}</a>
                  <div className="muted anchor-root">root {short(anchor.rootHash)} · {anchor.entries} entries · immutable</div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: live enforcement (the star) */}
        <section className="card enforce">
          <div className="card-title">
            <span>Live enforcement</span>
            {running && <span className="badge badge-live">● live</span>}
          </div>

          {task && (
            <div className="ticket">
              <div className="ticket-task">Task: {task.task}</div>
              <div className="ticket-warn">⚠ poisoned input (prompt injection):</div>
              <pre className="ticket-body">{task.ticket}</pre>
            </div>
          )}

          <div className="dec-feed">
            {decisions.length === 0 && !task && (
              <div className="muted dec-empty">Press <b>Run live attack</b> — watch a hijacked agent try to exfiltrate secrets, wire $5,000, and run shell, and get stopped in real time.</div>
            )}
            {decisions.map((d) => (
              <div key={d.seq} className={`dec ${d.verdict === "allow" ? "dec-allow" : "dec-block"}`}>
                <div className="dec-head">
                  <span className="dec-verdict">{d.verdict === "allow" ? "ALLOW" : "BLOCK"}</span>
                  <span className="dec-tool">{d.tool}({Object.values(d.args ?? {}).map(String).join(", ").slice(0, 60)})</span>
                  {d.estCostUsd > 0 && <span className="dec-cost">${d.estCostUsd.toLocaleString()}</span>}
                </div>
                <div className="dec-reason">{d.reason}</div>
                <div className="dec-rationale muted">agent said: “{d.rationale}”</div>
              </div>
            ))}
            <div ref={feedRef} />
          </div>

          {summary && (
            <div className="summary">
              <div className="metric"><b className="bad">{summary.blocked}</b><span>blocked</span></div>
              <div className="metric"><b className="ok">{summary.allowed}</b><span>allowed</span></div>
              <div className="metric"><b className="bad">${summary.blockedSpendUsd.toLocaleString()}</b><span>spend stopped</span></div>
            </div>
          )}
        </section>
      </main>

      <footer className="foot muted">
        AgentGuard · in-path enforcement + non-repudiable audit for autonomous agents
      </footer>
    </div>
  );
}
