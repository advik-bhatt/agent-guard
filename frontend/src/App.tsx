import { Background } from "./three/Background";
import { Demo } from "./components/Demo";

const REPO = "https://github.com/advik-bhatt/agent-work";

function Mark() {
  return (
    <svg width="30" height="33" viewBox="0 0 30 33" fill="none" aria-hidden="true">
      <path d="M15 1.4 28 8.2v9.3c0 8-6.4 11.6-13 13.6C8.4 29.1 2 25.5 2 17.5V8.2z" stroke="url(#mg)" strokeWidth="1.5" />
      <path d="M15 8.5v15.5M8.6 12.5 15 8.5l6.4 4" stroke="#00e5a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15" cy="20.5" r="1.7" fill="#00e5a0" />
      <defs>
        <linearGradient id="mg" x1="2" y1="1" x2="28" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00e5a0" />
          <stop offset="1" stopColor="#0a7f5e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function App() {
  return (
    <>
      <Background />
      <div className="page">
        <nav className="nav">
          <a className="brand" href="#top">
            <Mark />
            <span className="wordmark">AgentGuard</span>
          </a>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#demo">Live demo</a>
            <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
            <a className="nav-cta" href="#demo">Run the demo</a>
          </div>
        </nav>

        <header className="hero" id="top">
          <div className="eyebrow">Runtime security for autonomous agents</div>
          <h1>
            Ship AI agents that can act.<br />
            Without giving away the keys.
          </h1>
          <p className="sub">
            AgentGuard derives a least-privilege policy from your agent's own code, blocks unsafe
            tool calls in the request path before they run, and writes a tamper-proof, on-chain audit
            trail you can prove to an auditor.
          </p>
          <div className="hero-cta">
            <a className="btn btn-primary" href="#demo">See it stop a live attack</a>
            <a className="btn btn-ghost" href={REPO} target="_blank" rel="noreferrer">View the code</a>
          </div>
          <div className="hero-note">The category YC and a16z are funding. AgentGuard is the firewall and flight recorder for AI agents.</div>
        </header>

        <section className="band">
          <div className="band-head">
            <h2>Agents now hold the keys.</h2>
            <p>The model got good enough to act. The controls did not ship with it.</p>
          </div>
          <div className="stats">
            <div className="stat"><b>88%</b><span>of enterprises have already hit an agent security incident</span></div>
            <div className="stat"><b>21%</b><span>have any runtime visibility into what their agents do</span></div>
            <div className="stat"><b>Aug 2026</b><span>EU AI Act mandates tamper-proof agent audit trails</span></div>
          </div>
          <p className="band-foot">
            The most common failure is prompt injection: a hostile instruction hidden in the data an
            agent reads. The agent follows it as readily as a real one, and suddenly it is wiring
            money or leaking secrets on your infrastructure.
          </p>
        </section>

        <section className="how" id="how">
          <div className="how-step">
            <div className="step-no">01</div>
            <h3>Derive policy from code</h3>
            <p>AgentGuard reads the agent's source and classifies every tool it exposes: safe reads, money-movers, and forbidden calls like shell and secrets. The policy comes from the code, not a config someone forgot to update.</p>
          </div>
          <div className="how-step">
            <div className="step-no">02</div>
            <h3>Enforce in the request path</h3>
            <p>Every tool call is intercepted before it executes and checked against that policy in real time. Safe actions pass. Forbidden calls and over-budget spend are blocked at the moment they are attempted.</p>
          </div>
          <div className="how-step">
            <div className="step-no">03</div>
            <h3>Prove it on-chain</h3>
            <p>Every verdict is written to a hash-chained ledger, and the root is anchored on-chain. The result is a non-repudiable audit trail, the one guarantee a logging dashboard structurally cannot give.</p>
          </div>
        </section>

        <section className="demo-section" id="demo">
          <div className="band-head">
            <h2>Watch it intercept a hijacked agent.</h2>
            <p>A support agent is asked to resolve a ticket. The ticket is poisoned. Run it.</p>
          </div>
          <Demo />
        </section>

        <footer className="footer">
          <div className="brand">
            <Mark />
            <span className="wordmark">AgentGuard</span>
          </div>
          <div className="footer-line">In-path enforcement and non-repudiable audit for the agent economy.</div>
          <a href={REPO} target="_blank" rel="noreferrer">github.com/advik-bhatt/agent-work</a>
        </footer>
      </div>
    </>
  );
}
