import os
from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() == "true"


ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AGENT_MODEL = os.getenv("AGENT_MODEL", "claude-sonnet-4-6")
AGENT_MAX_STEPS = int(os.getenv("AGENT_MAX_STEPS", "6"))

GUARD_BUDGET_USD = float(os.getenv("GUARD_BUDGET_USD", "25"))
PERSEUS_ENABLED = _bool("PERSEUS_ENABLED", True)  # native, in-process; on by default
AGENT_REPO = os.getenv("AGENT_REPO", os.path.join(os.getcwd(), "fixtures", "support-agent"))

CHAIN_MODE = os.getenv("CHAIN_MODE", "simulation")
ANCHOR_RPC_URL = os.getenv("ANCHOR_RPC_URL", "https://sepolia.base.org")
EXPLORER_BASE = os.getenv("EXPLORER_BASE", "https://sepolia.basescan.org")
ANCHOR_PRIVATE_KEY = os.getenv("ANCHOR_PRIVATE_KEY", "")

PORT = int(os.getenv("PORT", "3001"))


def llm_provider() -> str:
    return "anthropic" if ANTHROPIC_API_KEY else "heuristic"
