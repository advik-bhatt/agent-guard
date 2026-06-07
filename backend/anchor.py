"""Anchor the audit ledger's root hash for non-repudiation.

Simulation by default (returns a realistic tx hash so the demo always runs).
Set CHAIN_MODE=live + ANCHOR_PRIVATE_KEY to write the root as the calldata of a
real EVM transaction (requires `web3`, installed on demand)."""
import os

from . import config


def anchor_root(root: str) -> dict:
    if config.CHAIN_MODE == "live" and config.ANCHOR_PRIVATE_KEY:
        try:
            from web3 import Web3  # optional dependency for live anchoring

            w3 = Web3(Web3.HTTPProvider(config.ANCHOR_RPC_URL))
            acct = w3.eth.account.from_key(config.ANCHOR_PRIVATE_KEY)
            tx = {
                "to": acct.address,
                "value": 0,
                "data": root,
                "nonce": w3.eth.get_transaction_count(acct.address),
                "gas": 30000,
                "gasPrice": w3.eth.gas_price,
                "chainId": w3.eth.chain_id,
            }
            signed = acct.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction).hex()
            return {"txHash": tx_hash, "explorerUrl": f"{config.EXPLORER_BASE}/tx/{tx_hash}", "simulated": False}
        except Exception as exc:  # fall back to sim rather than break the demo
            print(f"[anchor] live anchor failed ({exc}); using simulation")

    fake = "0x" + os.urandom(32).hex()
    return {"txHash": fake, "explorerUrl": f"{config.EXPLORER_BASE}/tx/{fake}", "simulated": True}
