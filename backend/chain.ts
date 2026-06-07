import { randomBytes } from "node:crypto";
import { ethers } from "ethers";
import { config, explorerTx } from "./config";
import { ESCROW_ABI, REPUTATION_ABI } from "./abi";
import type { ReputationSummary } from "./types";

export interface ChainStep {
  txHash: string;
  explorerUrl: string;
  simulated: boolean;
}
export interface PostResult extends ChainStep {
  taskId: string;
}
export interface VerifyResult extends ChainStep {
  paid: boolean;
  amount: string;
}

export interface ChainInfo {
  mode: "simulation" | "live";
  contract: string;
  identityRegistry: string;
  reputationRegistry: string;
  workerWallet: string;
  workerAgentId: string;
  verifierAgentId: string;
}

export interface Chain {
  readonly mode: "simulation" | "live";
  info(): ChainInfo;
  postTask(description: string, bountyMnt: string): Promise<PostResult>;
  claimTask(taskId: string, agentId: string): Promise<ChainStep>;
  submitWork(taskId: string, result: string): Promise<ChainStep>;
  verifyAndPay(taskId: string, approved: boolean, score: number, agentId: string): Promise<VerifyResult>;
  getReputation(agentId: string): Promise<ReputationSummary>;
}

const randomHash = () => "0x" + randomBytes(32).toString("hex");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Simulation ────────────────────────────────────────────────────────────
// Realistic flow with no chain dependency. Reputation accrues in-process so the
// fail→pass arc visibly moves the score across runs.
const SIM_WORKER_WALLET = "0xA17e0432B2D8e9D7C5B3F1aB2c4D6e8F09135724";
const simReputation = new Map<string, number[]>();

class SimulationChain implements Chain {
  readonly mode = "simulation" as const;
  private bounties = new Map<string, string>();
  private counter = 0;

  info(): ChainInfo {
    return {
      mode: this.mode,
      contract: config.contractAddress || "0x…(deployed on `npm run deploy`)",
      identityRegistry: config.identityRegistry || "AgentIdentityRegistry (ERC-8004)",
      reputationRegistry: config.reputationRegistry || "AgentReputationRegistry (ERC-8004)",
      workerWallet: SIM_WORKER_WALLET,
      workerAgentId: config.workerAgentId,
      verifierAgentId: config.verifierAgentId,
    };
  }

  async postTask(_description: string, bountyMnt: string): Promise<PostResult> {
    await wait(450);
    const taskId = String(++this.counter);
    this.bounties.set(taskId, bountyMnt);
    const txHash = randomHash();
    return { taskId, txHash, explorerUrl: explorerTx(txHash), simulated: true };
  }

  async claimTask(): Promise<ChainStep> {
    await wait(450);
    const txHash = randomHash();
    return { txHash, explorerUrl: explorerTx(txHash), simulated: true };
  }

  async submitWork(): Promise<ChainStep> {
    await wait(450);
    const txHash = randomHash();
    return { txHash, explorerUrl: explorerTx(txHash), simulated: true };
  }

  async verifyAndPay(taskId: string, approved: boolean, score: number, agentId: string): Promise<VerifyResult> {
    await wait(500);
    // Reputation is written on every verdict, mirroring the contract.
    const list = simReputation.get(agentId) ?? [];
    list.push(score);
    simReputation.set(agentId, list);
    const txHash = randomHash();
    return {
      txHash,
      explorerUrl: explorerTx(txHash),
      simulated: true,
      paid: approved && score >= config.threshold,
      amount: this.bounties.get(taskId) ?? config.bountyMnt,
    };
  }

  async getReputation(agentId: string): Promise<ReputationSummary> {
    const list = simReputation.get(agentId) ?? [];
    if (list.length === 0) return { count: 0, avgScore: 0 };
    const avg = list.reduce((a, b) => a + b, 0) / list.length;
    return { count: list.length, avgScore: Math.round(avg) };
  }
}

// ── Live (Mantle Sepolia) ───────────────────────────────────────────────────
class LiveChain implements Chain {
  readonly mode = "live" as const;
  private provider: ethers.JsonRpcProvider;
  private poster: ethers.Wallet;
  private worker: ethers.Wallet;
  private verifier: ethers.Wallet;
  private escrow: ethers.Contract;
  private reputation: ethers.Contract | null;
  private bounties = new Map<string, string>();

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl, {
      chainId: 5003,
      name: "mantle-sepolia",
    });
    this.poster = new ethers.Wallet(config.posterPk, this.provider);
    this.worker = new ethers.Wallet(config.workerPk, this.provider);
    this.verifier = new ethers.Wallet(config.verifierPk, this.provider);
    this.escrow = new ethers.Contract(config.contractAddress, ESCROW_ABI, this.provider);
    this.reputation = config.reputationRegistry
      ? new ethers.Contract(config.reputationRegistry, REPUTATION_ABI, this.provider)
      : null;
  }

  info(): ChainInfo {
    return {
      mode: this.mode,
      contract: config.contractAddress,
      identityRegistry: config.identityRegistry,
      reputationRegistry: config.reputationRegistry,
      workerWallet: this.worker.address,
      workerAgentId: config.workerAgentId,
      verifierAgentId: config.verifierAgentId,
    };
  }

  async postTask(description: string, bountyMnt: string): Promise<PostResult> {
    const c = this.escrow.connect(this.poster) as ethers.Contract;
    const tx = await c.postTask(description, { value: ethers.parseEther(bountyMnt) });
    const receipt = await tx.wait();

    let taskId = "";
    for (const log of receipt?.logs ?? []) {
      try {
        const parsed = this.escrow.interface.parseLog(log);
        if (parsed?.name === "TaskPosted") {
          taskId = parsed.args.id.toString();
          break;
        }
      } catch {
        /* not our log */
      }
    }
    if (!taskId) taskId = (await this.escrow.taskCount()).toString();
    this.bounties.set(taskId, bountyMnt);
    return { taskId, txHash: tx.hash, explorerUrl: explorerTx(tx.hash), simulated: false };
  }

  async claimTask(taskId: string, agentId: string): Promise<ChainStep> {
    const c = this.escrow.connect(this.worker) as ethers.Contract;
    const tx = await c.claimTask(BigInt(taskId), BigInt(agentId));
    await tx.wait();
    return { txHash: tx.hash, explorerUrl: explorerTx(tx.hash), simulated: false };
  }

  async submitWork(taskId: string, result: string): Promise<ChainStep> {
    const c = this.escrow.connect(this.worker) as ethers.Contract;
    const tx = await c.submitWork(BigInt(taskId), result);
    await tx.wait();
    return { txHash: tx.hash, explorerUrl: explorerTx(tx.hash), simulated: false };
  }

  async verifyAndPay(taskId: string, approved: boolean, score: number): Promise<VerifyResult> {
    // One transaction settles the verdict: pays the worker (iff approved) AND
    // writes the score to the ERC-8004 Reputation Registry.
    const c = this.escrow.connect(this.verifier) as ethers.Contract;
    const tx = await c.verifyAndPay(BigInt(taskId), approved, score);
    await tx.wait();
    return {
      txHash: tx.hash,
      explorerUrl: explorerTx(tx.hash),
      simulated: false,
      paid: approved && score >= config.threshold,
      amount: this.bounties.get(taskId) ?? config.bountyMnt,
    };
  }

  async getReputation(agentId: string): Promise<ReputationSummary> {
    if (!this.reputation) return { count: 0, avgScore: 0 };
    const [count, summaryValue] = await this.reputation.getSummary(
      BigInt(agentId),
      [],
      "quality",
      "agentwork"
    );
    return { count: Number(count), avgScore: Number(summaryValue) };
  }
}

let cached: Chain | null = null;

export function getChain(): Chain {
  if (cached) return cached;
  if (config.chainMode === "live") {
    const ready = config.contractAddress && config.posterPk && config.workerPk && config.verifierPk;
    if (ready) {
      cached = new LiveChain();
      console.log(`[chain] live → Mantle Sepolia, escrow ${config.contractAddress}`);
    } else {
      console.warn("[chain] CHAIN_MODE=live but contract/keys missing — falling back to simulation.");
      cached = new SimulationChain();
    }
  } else {
    cached = new SimulationChain();
  }
  return cached;
}
