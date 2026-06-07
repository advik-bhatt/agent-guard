# AgentGuard — the firewall & black box for AI agents

Companies are deploying autonomous agents that can **spend money, run code, and touch
production**. In 2026, **88% of enterprises have already hit an agent security
incident**, only 21% have runtime visibility, and the EU AI Act's tamper-proof
agent-audit obligations hit enforcement **Aug 2, 2026**.

**AgentGuard** sits in the agent's request path and:

1. **Derives a least-privilege policy from the agent's own code** (via **Perseus**, a
   live code-context engine) — safe read tools vs. money/secret/destructive tools.
2. **Enforces every tool call inline** — it *blocks* unsafe actions before they run
   (exfiltrate secrets, wire money over budget, `exec_shell`), not after the fact.
3. **Writes a hash-chained, on-chain-anchored audit trail** — a black box even *you*
   can't rewrite (non-repudiation is the one thing a SaaS dashboard structurally
   can't give).

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

| Sponsor | How it's used | Turn it on |
|---|---|---|
| **AWS Bedrock** | runs the governed agent | `BEDROCK_ENABLED=true` + `AWS_*` creds (model `us.anthropic.claude-sonnet-4-6`) |
| **Perseus** | derives the policy from the agent's codebase | `pip install perseus-ctx` then `PERSEUS_ENABLED=true` |
| **Replit** | one-click deploy + public URL | import repo → set Secrets → Deploy (`.replit` included) |
| on-chain anchor | non-repudiable audit root | `CHAIN_MODE=live` + `ANCHOR_PRIVATE_KEY` (any EVM testnet) |

Anthropic API works as a drop-in agent runtime if Bedrock isn't ready: set
`ANTHROPIC_API_KEY`.

### Deploy on Replit
Import this repo, add your keys as **Secrets**, set `VITE_BACKEND_URL=` (empty, for
same-origin), then **Deploy** (Autoscale). Build runs `npm run build`; the Express
server serves the built frontend and the API on one port.

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

Built for the NYTW Intern Hackathon — Best Overall + Best Use of Perseus.
