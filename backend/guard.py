"""In-request-path enforcement + a hash-chained, tamper-evident audit ledger."""
import hashlib
import json
from datetime import datetime, timezone

ZERO = "0x" + "0" * 64


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Guard:
    def __init__(self, policy: dict):
        self.rules = {t["tool"]: t for t in policy["tools"]}
        self.budget = float(policy["budgetUsd"])
        self.spent = 0.0
        self.ledger: list[dict] = []
        self.prev = ZERO

    def _digest(self, seq: int, ts: str, typ: str, data: dict) -> str:
        payload = self.prev + str(seq) + ts + typ + json.dumps(data, sort_keys=True, separators=(",", ":"))
        return "0x" + hashlib.sha256(payload.encode()).hexdigest()

    def record(self, typ: str, data: dict) -> dict:
        seq = len(self.ledger) + 1
        ts = _iso()
        h = self._digest(seq, ts, typ, data)
        entry = {"seq": seq, "ts": ts, "type": typ, "data": data, "prevHash": self.prev, "hash": h}
        self.ledger.append(entry)
        self.prev = h
        return entry

    def evaluate(self, tool: str, args: dict, est_cost: float = 0.0, rationale: str = ""):
        rule = self.rules.get(tool)
        verdict, reason = "allow", "Within policy"
        sensitivity = rule["sensitivity"] if rule else "unknown"

        if rule is None:
            verdict, reason = "block", f"Unknown tool '{tool}', not in the policy derived from the agent's code"
        elif rule["sensitivity"] == "forbidden":
            verdict, reason = "block", rule["reason"]
        elif rule["sensitivity"] == "sensitive":
            remaining = self.budget - self.spent
            if est_cost > remaining:
                verdict = "block"
                reason = f"${est_cost:g} exceeds remaining budget (${remaining:.2f}). Requires human approval."
            else:
                self.spent += est_cost
                reason = f"Sensitive but within budget (${est_cost:g} <= ${remaining:.2f} remaining)."

        entry = self.record(
            "action.allowed" if verdict == "allow" else "action.blocked",
            {"tool": tool, "args": args, "estCostUsd": est_cost, "rationale": rationale,
             "decision": verdict, "reason": reason},
        )
        decision = {"verdict": verdict, "tool": tool, "reason": reason, "sensitivity": sensitivity}
        return decision, entry

    @property
    def spent_usd(self) -> float:
        return self.spent

    def root(self) -> str:
        return self.prev

    def verify_integrity(self) -> bool:
        prev = ZERO
        for e in self.ledger:
            payload = prev + str(e["seq"]) + e["ts"] + e["type"] + json.dumps(e["data"], sort_keys=True, separators=(",", ":"))
            h = "0x" + hashlib.sha256(payload.encode()).hexdigest()
            if h != e["hash"] or e["prevHash"] != prev:
                return False
            prev = e["hash"]
        return True
