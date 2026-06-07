import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ChainMode = "simulation" | "live";
export type LlmProvider = "anthropic" | "bedrock" | "mock";

function readJson(file: string): Record<string, unknown> {
  const p = resolve(process.cwd(), file);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

const deployed = readJson(".deployed.json");
const agentIds = readJson(".agent-ids.json");

const pick = (...vals: Array<unknown>): string =>
  (vals.find((v) => v !== undefined && v !== null && v !== "") as string) || "";

export const config = {
  port: Number(process.env.PORT || 3001),
  bountyMnt: process.env.BOUNTY_MNT || "0.05",
  threshold: Number(process.env.VERIFIER_THRESHOLD || 65),

  chainMode: (process.env.CHAIN_MODE === "live" ? "live" : "simulation") as ChainMode,
  rpcUrl: process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz",
  explorer: process.env.VITE_MANTLE_EXPLORER || "https://explorer.sepolia.mantle.xyz",

  // LLM
  bedrockEnabled: (process.env.BEDROCK_ENABLED || "").toLowerCase() === "true",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  workerModel: process.env.WORKER_MODEL || "claude-opus-4-8",
  verifierModel: process.env.VERIFIER_MODEL || "claude-opus-4-8",
  bedrockModelId: process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-opus-4-8",
  awsRegion: process.env.AWS_REGION || "us-east-1",

  // Chain addresses / identities (env first, then deploy/register artifacts)
  contractAddress: pick(process.env.CONTRACT_ADDRESS, deployed.taskEscrow),
  reputationRegistry: pick(
    process.env.REPUTATION_REGISTRY_ADDRESS,
    process.env.ERC8004_REPUTATION_ADDRESS,
    deployed.reputationRegistry
  ),
  identityRegistry: pick(
    process.env.IDENTITY_REGISTRY_ADDRESS,
    process.env.ERC8004_IDENTITY_ADDRESS,
    deployed.identityRegistry
  ),
  workerAgentId: pick(process.env.WORKER_AGENT_ID, agentIds.workerAgentId, "1"),
  verifierAgentId: pick(process.env.VERIFIER_AGENT_ID, agentIds.verifierAgentId, "2"),

  posterPk: process.env.POSTER_PRIVATE_KEY || "",
  workerPk: process.env.WORKER_PRIVATE_KEY || "",
  verifierPk: process.env.VERIFIER_PRIVATE_KEY || "",
};

export function llmProvider(): LlmProvider {
  if (config.bedrockEnabled) return "bedrock";
  if (config.anthropicApiKey) return "anthropic";
  return "mock";
}

export function explorerTx(hash: string): string {
  return `${config.explorer}/tx/${hash}`;
}

export function explorerAddress(addr: string): string {
  return `${config.explorer}/address/${addr}`;
}
