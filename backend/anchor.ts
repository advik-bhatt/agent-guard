import { randomBytes } from "node:crypto";
import { ethers } from "ethers";
import { config, explorerTx } from "./config";

// Anchors the audit ledger's root hash on-chain for non-repudiation — the one
// guarantee a SaaS log structurally cannot give (you can't rewrite history once
// the root is committed to a public chain). Live mode writes the 32-byte root as
// the calldata of a self-transaction (no contract needed); sim mode returns a
// realistic hash so the demo always runs.
export async function anchorRoot(root: string): Promise<{ txHash: string; explorerUrl: string; simulated: boolean }> {
  const pk = process.env.ANCHOR_PRIVATE_KEY || config.posterPk;
  if (config.chainMode === "live" && pk) {
    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const wallet = new ethers.Wallet(pk, provider);
      const tx = await wallet.sendTransaction({ to: wallet.address, value: 0, data: root });
      await tx.wait();
      return { txHash: tx.hash, explorerUrl: explorerTx(tx.hash), simulated: false };
    } catch (err) {
      console.warn("[anchor] live anchor failed, using sim:", (err as Error).message);
    }
  }
  const fake = "0x" + randomBytes(32).toString("hex");
  return { txHash: fake, explorerUrl: explorerTx(fake), simulated: true };
}
