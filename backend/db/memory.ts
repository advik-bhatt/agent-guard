import type {
  AddEventInput,
  AddReputationInput,
  Agent,
  CreateTaskInput,
  ReputationEvent,
  Repo,
  Stats,
  Task,
  TaskEvent,
  UpsertAgentInput,
} from "./repo";

// In-memory backend (no DATABASE_URL). State lives for the life of the process,
// so the demo, reputation history, and marketplace all work with zero setup.
export class MemoryRepo implements Repo {
  readonly kind = "memory" as const;
  private agents: Agent[] = [];
  private tasks: Task[] = [];
  private events: TaskEvent[] = [];
  private reputation: ReputationEvent[] = [];
  private seq = { agent: 0, task: 0, event: 0, rep: 0 };

  async init() {}

  async upsertAgent(input: UpsertAgentInput): Promise<Agent> {
    let found =
      (input.agentId && this.agents.find((a) => a.agentId === input.agentId)) ||
      this.agents.find((a) => a.name === input.name && a.role === input.role);
    if (found) {
      found.wallet = input.wallet ?? found.wallet;
      found.agentUri = input.agentUri ?? found.agentUri;
      if (input.agentId) found.agentId = input.agentId;
      return found;
    }
    const agent: Agent = {
      id: ++this.seq.agent,
      agentId: input.agentId ?? null,
      name: input.name,
      role: input.role,
      wallet: input.wallet ?? null,
      agentUri: input.agentUri ?? null,
      createdAt: new Date().toISOString(),
    };
    this.agents.push(agent);
    return agent;
  }

  async listAgents(): Promise<Agent[]> {
    return [...this.agents].sort((a, b) => a.id - b.id);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: ++this.seq.task,
      onchainId: input.onchainId ?? null,
      poster: input.poster ?? null,
      workerAgentId: null,
      title: input.title ?? null,
      description: input.description,
      bountyMnt: input.bountyMnt,
      status: input.status ?? "open",
      score: null,
      approved: null,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.push(task);
    return task;
  }

  async getTask(id: number): Promise<Task | null> {
    return this.tasks.find((t) => t.id === id) ?? null;
  }

  async listTasks(limit = 50): Promise<Task[]> {
    return [...this.tasks].sort((a, b) => b.id - a.id).slice(0, limit);
  }

  async updateTask(id: number, patch: Partial<Task>): Promise<void> {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch, { updatedAt: new Date().toISOString() });
  }

  async addEvent(input: AddEventInput): Promise<void> {
    this.events.push({
      id: ++this.seq.event,
      taskId: input.taskId,
      type: input.type,
      message: input.message ?? null,
      txHash: input.txHash ?? null,
      simulated: input.simulated ?? false,
      payload: input.payload ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  async recentEvents(limit = 50): Promise<TaskEvent[]> {
    return [...this.events].sort((a, b) => b.id - a.id).slice(0, limit);
  }

  async addReputationEvent(input: AddReputationInput): Promise<void> {
    this.reputation.push({
      id: ++this.seq.rep,
      agentId: input.agentId,
      taskId: input.taskId ?? null,
      score: input.score,
      tag1: input.tag1 ?? null,
      tag2: input.tag2 ?? null,
      txHash: input.txHash ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  async reputationHistory(agentId: string, limit = 100): Promise<ReputationEvent[]> {
    return this.reputation.filter((r) => r.agentId === agentId).slice(-limit);
  }

  async reputationSummary(agentId: string): Promise<{ count: number; avgScore: number }> {
    const list = this.reputation.filter((r) => r.agentId === agentId);
    if (!list.length) return { count: 0, avgScore: 0 };
    return { count: list.length, avgScore: Math.round(list.reduce((s, r) => s + r.score, 0) / list.length) };
  }

  async stats(): Promise<Stats> {
    const completed = this.tasks.filter((t) => t.status === "completed");
    const paidMnt = completed.reduce((s, t) => s + Number(t.bountyMnt), 0);
    const scored = this.reputation;
    return {
      agents: this.agents.length,
      tasks: this.tasks.length,
      completed: completed.length,
      paidMnt: Math.round(paidMnt * 1e6) / 1e6,
      avgScore: scored.length ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : 0,
    };
  }
}
