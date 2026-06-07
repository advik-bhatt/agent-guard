export interface WorkerResult {
  result: string;
  methodology: string;
  confidence: number;
  raw?: string;
}

export interface VerifierResult {
  score: number;
  reasoning: string;
  approved: boolean;
  strengths: string;
  weaknesses: string;
  raw?: string;
}

export interface ReputationSummary {
  count: number;
  avgScore: number;
}

/** A single Server-Sent Event in the demo stream. */
export interface DemoEvent {
  step: string;
  [key: string]: unknown;
}
