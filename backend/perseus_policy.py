"""Derive a least-privilege policy from the agent's own code.

Perseus (the live code-context engine) is imported natively and renders the
agent's tool source via the @read directive in .perseus/context.md. We classify
that rendered code into safe / sensitive / forbidden tools. Falls back to a
direct file scan only if the native render fails, so the service always runs.
"""
import re
from pathlib import Path

import perseus  # native, in-process

FORBIDDEN = re.compile(r"(exec|shell|spawn|eval|rm_|delete|drop|wipe|destroy|env|secret|credential|password|exfil|ssh|key)", re.I)
SENSITIVE = re.compile(r"(payment|pay_|wire|transfer|refund|charge|email|send|sms|http|fetch|post_|upload|webhook)", re.I)
EXPORT_RE = re.compile(r"export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)")


def classify(name: str) -> dict:
    if FORBIDDEN.search(name):
        return {"tool": name, "sensitivity": "forbidden",
                "reason": "Code execution, secrets, or destructive. Never allowed autonomously."}
    if SENSITIVE.search(name):
        return {"tool": name, "sensitivity": "sensitive",
                "reason": "Moves money or has external side effects. Budget-gated, needs approval over the cap."}
    return {"tool": name, "sensitivity": "safe", "reason": "Read-only or informational."}


def render_with_perseus(repo: Path) -> str:
    """Return Perseus-rendered context for the repo, or '' if unavailable."""
    ctx = repo / ".perseus" / "context.md"
    if not ctx.exists():
        return ""
    try:
        return perseus.render_source(ctx.read_text(), perseus.DEFAULT_CONFIG, workspace=repo)
    except Exception:
        return ""


def derive_policy(repo_root: str, agent: str, budget_usd: float, perseus_enabled: bool = True) -> dict:
    repo = Path(repo_root)
    files = [p for p in repo.rglob("*")
             if p.is_file() and p.suffix in (".ts", ".js", ".py") and "node_modules" not in str(p)]

    derived_by = "static"
    source_text = ""
    if perseus_enabled:
        rendered = render_with_perseus(repo)
        if "export" in rendered and "function" in rendered:
            source_text = rendered           # Perseus surfaced the code
            derived_by = "perseus"

    if not source_text:
        tool_file = next((p for p in files if re.search(r"tools?\.(ts|js|py)$", p.name)),
                         files[0] if files else None)
        source_text = tool_file.read_text() if tool_file else ""

    names: list[str] = []
    for m in EXPORT_RE.finditer(source_text):
        if m.group(1) not in names:
            names.append(m.group(1))

    return {
        "agent": agent,
        "sourceRepo": str(repo),
        "derivedBy": derived_by,
        "tools": [classify(n) for n in names],
        "budgetUsd": budget_usd,
        "filesScanned": len(files),
    }
