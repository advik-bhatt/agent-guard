import { useEffect, useRef } from "react";
import type { LogEntry } from "../types";

export function AgentStream({ log, running }: { log: LogEntry[]; running: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [log]);

  return (
    <section className="card stream">
      <div className="card-title">
        <span>Agent Activity</span>
        {running && <span className="badge badge-live">● live</span>}
      </div>

      <div className="stream-feed">
        {log.length === 0 && (
          <div className="muted stream-empty">
            Press <b>Run Demo</b> — you'll watch a worker agent get hired, do the
            work, get graded by a second agent, and get paid on-chain.
          </div>
        )}

        {log.map((e) => {
          if (e.kind === "worker" && e.worker) {
            return (
              <div key={e.id} className="logrow worker-card">
                <div className="worker-head">◆ Worker agent output</div>
                <pre className="worker-result">{e.worker.result}</pre>
                <div className="worker-meta">
                  <span className="muted">method:</span> {e.worker.methodology}
                </div>
                <div className="confidence">
                  <span className="muted">confidence</span>
                  <div className="bar">
                    <div className="bar-fill" style={{ width: `${e.worker.confidence}%` }} />
                  </div>
                  <span>{e.worker.confidence}</span>
                </div>
              </div>
            );
          }

          if (e.kind === "verdict" && e.verdict) {
            const v = e.verdict;
            return (
              <div key={e.id} className="logrow verdict-card">
                <div className="verdict-head">◆ Verifier verdict</div>
                <div className={`verdict-score ${v.approved ? "ok" : "bad"}`}>{v.score}</div>
                <div className="verdict-sub muted">/ 100 · bar is {v.threshold}</div>
                <div className="verdict-reason">{v.reasoning}</div>
                <div className="verdict-sw">
                  <div>
                    <span className="muted">+ </span>
                    {v.strengths}
                  </div>
                  <div>
                    <span className="muted">− </span>
                    {v.weaknesses}
                  </div>
                </div>
                <div className={`verdict-flag ${v.approved ? "ok" : "bad"}`}>
                  {v.approved ? "APPROVED ✓" : "REJECTED ✗"}
                </div>
              </div>
            );
          }

          const icon =
            e.kind === "chain" ? "⛓" : e.kind === "pay" ? "✓" : e.kind === "error" ? "✗" : "◆";
          return (
            <div key={e.id} className={`logrow line line-${e.kind}`}>
              <span className="line-icon">{icon}</span>
              <span>{e.text}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </section>
  );
}
