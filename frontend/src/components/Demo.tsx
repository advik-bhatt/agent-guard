import { useEffect, useRef, useState } from "react";
import { BACKEND, streamGuard } from "../api";

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

const short = (h: string) => (h && h.startsWith("0x") && h.length > 18 ? `${h.slice(0, 10)} / ${h.slice(-6)}` : h);

function Play() {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true">
      <path d="M1.2 1.1 11 6.5 1.2 11.9z" fill="currentColor" />
    </svg>
  );
}

export function Demo() {
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
    <div className="demo">
      <div className="demo-bar">
        <button className="run-btn" onClick={run} disabled={running}>
          {running ? <span className="spinner" /> : <Play />} {running ? "Intercepting…" : "Run live attack"}
        </button>
        <div className="mode-tags">
          <span className="mode">agent: {policy?.llm ?? health?.llm ?? "…"}</span>
          <span className="mode">chain: {health?.chainMode ?? "…"}</span>
        </div>
        {status && <span className="status-line">{status}</span>}
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="guard-grid">
        <div className="col">
          <section className="card">
            <div className="card-title">
              <span>Agent &amp; derived policy</span>
              {policy && <span className={`badge ${policy.derivedBy === "perseus" ? "badge-mantle" : "badge-amber"}`}>{policy.derivedBy === "perseus" ? "Perseus" : "static"} engine</span>}
            </div>
            <div className="identity-id">{policy?.agent ?? "Awaiting run"}</div>
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
              {!policy && <div className="muted">Run the demo to derive the policy from code.</div>}
            </div>
          </section>

          <section className="card">
            <div className="card-title">
              <span>Tamper-proof ledger</span>
              {summary && <span className={`badge ${summary.integrity ? "badge-green" : "badge-live"}`}>{summary.integrity ? "integrity ok" : "broken"}</span>}
            </div>
            <div className="ledger">
              {decisions.length === 0 && <div className="muted">Each verdict is hash-chained to the last.</div>}
              {decisions.map((d) => (
                <div key={d.seq} className="ledger-row">
                  <span className="muted">{String(d.seq).padStart(2, "0")}</span>
                  <i className={`dot ${d.verdict === "allow" ? "dot-ok" : "dot-bad"}`} />
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

        <section className="card enforce">
          <div className="card-title">
            <span>Live enforcement</span>
            {running && <span className="badge badge-live">recording</span>}
          </div>

          {task && (
            <div className="ticket">
              <div className="ticket-task">Task: {task.task}</div>
              <div className="ticket-warn">Poisoned input · prompt injection</div>
              <pre className="ticket-body">{task.ticket}</pre>
            </div>
          )}

          <div className="dec-feed">
            {decisions.length === 0 && !task && (
              <div className="muted dec-empty">Press Run live attack. A hijacked agent will try to exfiltrate a secret, wire $5,000, and run shell, and get stopped in real time.</div>
            )}
            {decisions.map((d) => (
              <div key={d.seq} className={`dec ${d.verdict === "allow" ? "dec-allow" : "dec-block"}`}>
                <div className="dec-head">
                  <span className="dec-verdict">{d.verdict === "allow" ? "ALLOW" : "BLOCK"}</span>
                  <span className="dec-tool">{d.tool}({Object.values(d.args ?? {}).map(String).join(", ").slice(0, 56)})</span>
                  {d.estCostUsd > 0 && <span className="dec-cost">${d.estCostUsd.toLocaleString()}</span>}
                </div>
                <div className="dec-reason">{d.reason}</div>
                {d.rationale && <div className="dec-rationale muted">agent: {d.rationale}</div>}
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
      </div>
    </div>
  );
}
