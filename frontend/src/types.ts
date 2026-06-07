export interface Identity {
  chainMode: "simulation" | "live";
  llm: "anthropic" | "bedrock" | "mock";
  workerModel: string;
  verifierModel: string;
  bounty: string;
  threshold: number;
  workerAgentId: string;
  verifierAgentId: string;
  workerWallet: string;
  identityRegistry: string;
  reputationRegistry: string;
  contract: string;
}

export interface WorkerResult {
  result: string;
  methodology: string;
  confidence: number;
}

export interface Verdict {
  score: number;
  reasoning: string;
  strengths: string;
  weaknesses: string;
  approved: boolean;
  threshold: number;
}

export interface Tx {
  label: string;
  hash: string;
  url: string;
  simulated: boolean;
}

export interface Reputation {
  count: number;
  avgScore: number;
  latest?: number;
}

export type Status = "Idle" | "Open" | "Claimed" | "Submitted" | "Completed" | "Failed";

export interface LogEntry {
  id: number;
  kind: "chain" | "agent" | "worker" | "verdict" | "pay" | "error";
  text?: string;
  worker?: WorkerResult;
  verdict?: Verdict;
}

export interface TaskMeta {
  id: string;
  title: string;
  description: string;
  expectPass: boolean;
}
