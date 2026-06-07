// Repository interface shared by the Postgres and in-memory backends.
export interface Agent {
  id: number;
  agentId: string | null;
  name: string;
  role: string;
  wallet: string | null;
  agentUri: string | null;
  createdAt: string;
}

export interface Task {
  id: number;
  onchainId: string | null;
  poster: string | null;
  workerAgentId: string | null;
  title: string | null;
  description: string;
  bountyMnt: string;
  status: string;
  score: number | null;
  approved: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEvent {
  id: number;
  taskId: number;
  type: string;
  message: string | null;
  txHash: string | null;
  simulated: boolean;
  payload: unknown;
  createdAt: string;
}

export interface ReputationEvent {
  id: number;
  agentId: string;
  taskId: number | null;
  score: number;
  tag1: string | null;
  tag2: string | null;
  txHash: string | null;
  createdAt: string;
}

export interface Stats {
  agents: number;
  tasks: number;
  completed: number;
  paidMnt: number;
  avgScore: number;
}

export interface UpsertAgentInput {
  agentId?: string | null;
  name: string;
  role: string;
  wallet?: string | null;
  agentUri?: string | null;
}

export interface CreateTaskInput {
  onchainId?: string | null;
  poster?: string | null;
  title?: string | null;
  description: string;
  bountyMnt: string;
  status?: string;
}

export interface AddEventInput {
  taskId: number;
  type: string;
  message?: string | null;
  txHash?: string | null;
  simulated?: boolean;
  payload?: unknown;
}

export interface AddReputationInput {
  agentId: string;
  taskId?: number | null;
  score: number;
  tag1?: string;
  tag2?: string;
  txHash?: string | null;
}

export interface Repo {
  readonly kind: "postgres" | "memory";
  init(): Promise<void>;

  upsertAgent(input: UpsertAgentInput): Promise<Agent>;
  listAgents(): Promise<Agent[]>;

  createTask(input: CreateTaskInput): Promise<Task>;
  getTask(id: number): Promise<Task | null>;
  listTasks(limit?: number): Promise<Task[]>;
  updateTask(id: number, patch: Partial<Pick<Task, "status" | "score" | "approved" | "workerAgentId" | "onchainId">>): Promise<void>;

  addEvent(input: AddEventInput): Promise<void>;
  recentEvents(limit?: number): Promise<TaskEvent[]>;

  addReputationEvent(input: AddReputationInput): Promise<void>;
  reputationHistory(agentId: string, limit?: number): Promise<ReputationEvent[]>;
  reputationSummary(agentId: string): Promise<{ count: number; avgScore: number }>;

  stats(): Promise<Stats>;
}
