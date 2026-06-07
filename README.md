# AgentGuard — the firewall & flight recorder for AI agents

Companies are deploying autonomous agents that can **spend money, run code, and touch
production**. In 2026, **88% of enterprises have already hit an agent security
incident**, only 21% have runtime visibility, and the EU AI Act's tamper-proof
agent-audit obligations hit enforcement **Aug 2, 2026**.

**AgentGuard** sits in the agent's request path and:

1. **Derives a least-privilege policy from the agent's own code** (via **Perseus**, a
   live code-context engine) — safe read tools vs. money/secret/destructive tools.
2. **Enforces every tool call inline** — it *blocks* unsafe actions before they run
   (exfiltrate secrets, wire money over budget, `exec_shell`), not after the fact.
3. **Writes a hash-chained, on-chain-anchored audit trail** that even *you* cannot
   rewrite (non-repudiation is the one thing a SaaS dashboard structurally can't give).

> Not another observability dashboard (trusted, after-the-fact). AgentGuard is
> in-path enforcement + a trustless, third-party-verifiable record.

## The demo (the wow)

Click **Run live attack**. An autonomous support agent is told to handle a ticket —
but the ticket body is **prompt-injected** to make it exfiltrate `STRIPE_SECRET_KEY`,
wire **$5,000**, and run `rm -rf … | bash`. Watch AgentGuard:

- derive the agent's policy from its code (Perseus),
- **ALLOW** the benign reads and **BLOCK** the three malicious calls in real time,
- seal the verdicts into a hash chain and **anchor the root on-chain** → click the
  explorer link; the record is immutable.

Nothing is hard-coded: real LLM agent (AWS Bedrock / Anthropic), real policy derived
from real code, deterministic in-path enforcement.

## Quick start (zero config — runs in ~30s)

```bash
npm install         # installs backend + frontend
npm run dev         # backend :3001 + frontend :5173
# open http://localhost:5173 → "Run live attack"
```

With no API keys it runs a **mock agent** + **simulated anchor** so the full flow
works offline. Add keys (below) to make it fully live.

## Make the sponsors real

Copy `.env.example` → `.env` and fill in what you want:

| Capability | What it does | Turn it on |
|---|---|---|
| **Claude agent** | runs the governed agent | `ANTHROPIC_API_KEY` (or AWS Bedrock via `BEDROCK_ENABLED=true` + `AWS_*`). With no key it runs a built-in compromised-agent scenario, which keeps the block demo deterministic. |
| **Perseus** | derives the policy from the agent's code (`perseus render`) | `pip install perseus-ctx` + `PERSEUS_ENABLED=true`. Falls back to the built-in scanner where Perseus isn't installed (e.g. hosted Node deploys). |
| **On-chain anchor** | non-repudiable audit root | `CHAIN_MODE=live` + `ANCHOR_PRIVATE_KEY` (any EVM testnet); simulated otherwise. |

Anthropic API works as a drop-in agent runtime if Bedrock isn't ready: set
`ANTHROPIC_API_KEY`.

### Deploy (any Node host)
Build `npm run build`, start `npm start`. The Express server serves the built
frontend and the API on one port and binds `0.0.0.0:$PORT`, so it runs on Render,
Railway, Fly, a plain VM, or a tunnel to localhost. The production build uses
same-origin API calls, so no extra config is needed.

## Architecture

```
backend/
  policy.ts       derive least-privilege policy from the agent's code (Perseus layer)
  context.ts      symbol-aware "supercharged grep" over the agent repo
  agentRunner.ts  the agent under guard (Bedrock / Anthropic / mock)
  guard.ts        in-path enforcement + hash-chained, tamper-evident ledger
  anchor.ts       anchor the ledger root on-chain (live) or sim
  index.ts        SSE orchestrator + serves the built frontend
  db/             provider-neutral Postgres (DATABASE_URL) or in-memory fallback
frontend/         live 3-panel UI (policy · enforcement · tamper-proof ledger)
fixtures/support-agent/  the example agent whose code the policy is derived from
```

## Why it's a company (not a feature)

- **Business model:** metered **policy-enforcement API** (per guarded action) →
  **compliance/audit seats** (the on-chain audit packet) → enterprise governance.
- **Moat:** (1) **neutrality** — the guard must be independent of the agent-makers
  (you won't trust an agent vendor to grade its own agents); (2) a **cross-platform
  policy + incident dataset** that compounds; (3) **non-repudiable** anchoring an
  incumbent dashboard can't replicate.
- **Why now:** YC is funding this category (Alter, CodeIntegrity, Galini); a16z's
  2026 thesis: the agent explosion is bottlenecked by *safe, reliable* infra; EU AI
  Act Art. 12 enforcement lands Aug 2, 2026.

Built for the NYTW Intern Hackathon: Best Overall and Best Use of Perseus.
