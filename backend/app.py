import json
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from . import config
from .agent import run_agent
from .anchor import anchor_root
from .guard import Guard
from .perseus_policy import derive_policy
from .scenario import DEFAULT_TICKET, task_summary

app = FastAPI(title="AgentGuard")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _sse(d: dict) -> str:
    return f"data: {json.dumps(d)}\n\n"


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "product": "AgentGuard",
        "backend": "python / fastapi",
        "llm": config.llm_provider(),
        "model": config.AGENT_MODEL,
        "chainMode": config.CHAIN_MODE,
        "perseus": config.PERSEUS_ENABLED,
    }


@app.get("/api/guard/demo")
def demo(request: Request, ticket: str | None = None):
    tk = (ticket or DEFAULT_TICKET).strip()

    def gen():
        try:
            yield _sse({"step": "deriving", "message": "Perseus reading the agent's code to derive a least-privilege policy..."})
            policy = derive_policy(config.AGENT_REPO, "AcmeCo Support Agent", config.GUARD_BUDGET_USD, config.PERSEUS_ENABLED)
            guard = Guard(policy)
            guard.record("policy.derived", {"tools": policy["tools"], "budgetUsd": policy["budgetUsd"]})
            yield _sse({
                "step": "policy",
                "agent": policy["agent"],
                "sourceRepo": policy["sourceRepo"].replace(os.getcwd(), "."),
                "derivedBy": policy["derivedBy"],
                "filesScanned": policy["filesScanned"],
                "budgetUsd": policy["budgetUsd"],
                "tools": policy["tools"],
                "llm": config.llm_provider(),
            })
            yield _sse({"step": "task", "task": task_summary(tk), "ticket": tk})
            yield _sse({"step": "thinking", "message": "Agent starting on the ticket..."})

            allowed = blocked = 0
            blocked_spend = 0.0
            for ev in run_agent(guard, tk):
                if ev.get("step") == "decision":
                    if ev["verdict"] == "allow":
                        allowed += 1
                    else:
                        blocked += 1
                        blocked_spend += ev.get("estCostUsd", 0) or 0
                yield _sse(ev)

            yield _sse({
                "step": "summary", "allowed": allowed, "blocked": blocked,
                "blockedSpendUsd": round(blocked_spend, 2), "total": allowed + blocked,
                "integrity": guard.verify_integrity(),
            })
            yield _sse({"step": "sealing", "message": "Sealing the ledger and anchoring its root..."})
            guard.record("ledger.sealed", {"entries": len(guard.ledger)})
            a = anchor_root(guard.root())
            yield _sse({
                "step": "anchored", "rootHash": guard.root(), "txHash": a["txHash"],
                "explorerUrl": a["explorerUrl"], "simulated": a["simulated"], "entries": len(guard.ledger),
            })
            yield _sse({"step": "done", "allowed": allowed, "blocked": blocked, "anchored": True})
        except Exception as exc:  # noqa: BLE001
            yield _sse({"step": "error", "message": str(exc)})
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Serve the built frontend (single port) ───────────────────────────────────
DIST = Path(os.getcwd()) / "frontend" / "dist"


@app.get("/")
def index():
    f = DIST / "index.html"
    return FileResponse(str(f)) if f.exists() else {"service": "agentguard", "status": "ok"}


@app.get("/{full_path:path}")
def spa(full_path: str):
    if full_path.startswith("api/"):
        return {"error": "not found"}
    target = DIST / full_path
    if target.is_file():
        return FileResponse(str(target))
    idx = DIST / "index.html"
    return FileResponse(str(idx)) if idx.exists() else {"error": "frontend not built"}
