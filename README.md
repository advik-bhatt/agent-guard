# AgentGuard — the firewall & flight recorder for AI agents

AI agents now hold real keys. They can spend money, run code, and touch production.
In 2026, 88% of enterprises have already hit an agent security incident, only 21% have
runtime visibility, and the EU AI Act's tamper-proof agent-audit obligations reach
enforcement on Aug 2, 2026. The most common failure is prompt injection: a hostile
instruction hidden in the data an agent reads.

**AgentGuard** sits in the agent's request path and:

1. **Derives a least-privilege policy from the agent's own code.** Perseus (a code-context
   engine) is imported in-process to read the agent's tools, which AgentGuard classifies
   into safe reads, money-movers, and forbidden calls.
2. **Enforces every tool call in real time.** Unsafe actions (reading secrets, wiring money
   over budget, running shell) are blocked before they execute, then fed back to the agent.
3. **Writes a hash-chained, on-chain-anchored audit trail** that cannot be quietly rewritten.

It is not another observability dashboard, which is trusted and after-the-fact. AgentGuard
is in-path enforcement plus a third-party-verifiable record.

## Stack

- **Backend:** Python + FastAPI, streaming over Server-Sent Events.
- **Policy:** Perseus imported natively (`perseus.render_source`) to read the agent's code.
- **Agent:** a real Claude tool-use loop (Anthropic API) that genuinely decides its actions
  and is governed live. With no key it runs an input-driven heuristic agent so the flow
  still works.
- **Audit:** SHA-256 hash-chained ledger; EVM anchor (simulated by default, real with a key).
- **Frontend:** React + Vite + Three.js.

## Run locally

Prereqs: Python 3.11+ and Node 20+.

```bash
pip install -r backend/requirements.txt
npm install && npm run build                      # builds the frontend into frontend/dist
ANTHROPIC_API_KEY=sk-ant-... uvicorn backend.app:app --host 0.0.0.0 --port 3001
# open http://localhost:3001
```

Set `ANTHROPIC_API_KEY` for the real, non-deterministic LLM agent. Without it the demo
still runs (heuristic agent). For hot-reload during development, run the uvicorn command
above and, in another terminal, `npm run dev` (Vite on :5173).

## Try it

Open the page. Optionally type your own attack in the box (a support ticket with a hidden
instruction to leak a key, wire money, or run shell), then run it. The agent decides what
to do; AgentGuard enforces the policy and anchors the audit trail. Different inputs and
different runs produce different agent behavior; the enforcement is what stays constant.

## Deploy (Docker)

A `Dockerfile` is included. It builds the frontend, installs the Python backend, and serves
both on one port (`$PORT`).

- **Render:** New → Web Service → connect the repo → Render detects the Dockerfile and uses
  the Docker runtime → Deploy. Add `ANTHROPIC_API_KEY` in the service environment for the
  real agent. You get a stable public URL that updates on every push.
- **Anywhere Docker runs:**
  ```bash
  docker build -t agentguard .
  docker run -p 8080:8080 -e ANTHROPIC_API_KEY=sk-ant-... agentguard
  ```

## How Perseus is used

`fixtures/support-agent/.perseus/context.md` uses Perseus's `@read tools.ts` directive.
`backend/perseus_policy.py` calls `perseus.render_source(...)` in-process to pull that
source, then classifies each exported tool into the policy. When it runs, the policy panel
shows the **Perseus** engine.

## Architecture

```
backend/
  perseus_policy.py  derive the policy from the agent's code (Perseus, in-process)
  agent.py           the governed agent: real Claude tool-use loop, heuristic fallback
  guard.py           in-path enforcement + hash-chained, tamper-evident ledger
  anchor.py          anchor the ledger root on-chain (live) or simulated
  app.py             FastAPI app: SSE endpoint + serves the built frontend
frontend/            React + Vite + Three.js (landing page + live demo)
fixtures/support-agent/  the example agent whose code the policy is derived from
```

## Why it's a company (not a feature)

- **Business model:** metered policy-enforcement API (per guarded action), then
  compliance and audit (the on-chain audit packet), then enterprise governance.
- **Moat:** neutrality (the trust arbiter has to be independent of the agent makers),
  a cross-platform incident dataset that compounds, and a non-repudiable on-chain record
  an incumbent dashboard cannot replicate.
- **Why now:** YC is funding this category (Alter, CodeIntegrity, Galini); a16z's 2026
  thesis is that the agent explosion is bottlenecked by safe, reliable infrastructure;
  EU AI Act Art. 12 enforcement lands Aug 2, 2026.

Built for the NYTW Intern Hackathon: Best Overall and Best Use of Perseus.
