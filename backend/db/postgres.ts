import pg from "pg";
import { SCHEMA_SQL } from "./schema";
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

const rowToAgent = (r: any): Agent => ({
  id: r.id,
  agentId: r.agent_id != null ? String(r.agent_id) : null,
  name: r.name,
  role: r.role,
  wallet: r.wallet,
  agentUri: r.agent_uri,
  createdAt: r.created_at,
});

const rowToTask = (r: any): Task => ({
  id: r.id,
  onchainId: r.onchain_id != null ? String(r.onchain_id) : null,
  poster: r.poster,
  workerAgentId: r.worker_agent_id != null ? String(r.worker_agent_id) : null,
  title: r.title,
  description: r.description,
  bountyMnt: String(r.bounty_mnt),
  status: r.status,
  score: r.score,
  approved: r.approved,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class PostgresRepo implements Repo {
  readonly kind = "postgres" as const;
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
  }

  async init() {
    await this.pool.query(SCHEMA_SQL);
  }

  async upsertAgent(input: UpsertAgentInput): Promise<Agent> {
    if (input.agentId) {
      const { rows } = await this.pool.query(
        `insert into agents (agent_id, name, role, wallet, agent_uri)
         values ($1,$2,$3,$4,$5)
         on conflict (agent_id) do update set
           name = excluded.name, role = excluded.role,
           wallet = coalesce(excluded.wallet, agents.wallet),
           agent_uri = coalesce(excluded.agent_uri, agents.agent_uri)
         returning *`,
        [input.agentId, input.name, input.role, input.wallet ?? null, input.agentUri ?? null]
      );
      return rowToAgent(rows[0]);
    }
    const existing = await this.pool.query(`select * from agents where name=$1 and role=$2 limit 1`, [
      input.name,
      input.role,
    ]);
    if (existing.rows[0]) return rowToAgent(existing.rows[0]);
    const { rows } = await this.pool.query(
      `insert into agents (name, role, wallet, agent_uri) values ($1,$2,$3,$4) returning *`,
      [input.name, input.role, input.wallet ?? null, input.agentUri ?? null]
    );
    return rowToAgent(rows[0]);
  }

  async listAgents(): Promise<Agent[]> {
    const { rows } = await this.pool.query(`select * from agents order by id asc`);
    return rows.map(rowToAgent);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const { rows } = await this.pool.query(
      `insert into tasks (onchain_id, poster, title, description, bounty_mnt, status)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [input.onchainId ?? null, input.poster ?? null, input.title ?? null, input.description, input.bountyMnt, input.status ?? "open"]
    );
    return rowToTask(rows[0]);
  }

  async getTask(id: number): Promise<Task | null> {
    const { rows } = await this.pool.query(`select * from tasks where id=$1`, [id]);
    return rows[0] ? rowToTask(rows[0]) : null;
  }

  async listTasks(limit = 50): Promise<Task[]> {
    const { rows } = await this.pool.query(`select * from tasks order by id desc limit $1`, [limit]);
    return rows.map(rowToTask);
  }

  async updateTask(id: number, patch: Partial<Task>): Promise<void> {
    const map: Record<string, string> = {
      status: "status",
      score: "score",
      approved: "approved",
      workerAgentId: "worker_agent_id",
      onchainId: "onchain_id",
    };
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(map)) {
      if (k in patch) {
        sets.push(`${col}=$${i++}`);
        vals.push((patch as any)[k]);
      }
    }
    if (!sets.length) return;
    sets.push(`updated_at=now()`);
    vals.push(id);
    await this.pool.query(`update tasks set ${sets.join(", ")} where id=$${i}`, vals);
  }

  async addEvent(input: AddEventInput): Promise<void> {
    await this.pool.query(
      `insert into task_events (task_id, type, message, tx_hash, simulated, payload)
       values ($1,$2,$3,$4,$5,$6)`,
      [input.taskId, input.type, input.message ?? null, input.txHash ?? null, input.simulated ?? false, input.payload ? JSON.stringify(input.payload) : null]
    );
  }

  async recentEvents(limit = 50): Promise<TaskEvent[]> {
    const { rows } = await this.pool.query(`select * from task_events order by id desc limit $1`, [limit]);
    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      type: r.type,
      message: r.message,
      txHash: r.tx_hash,
      simulated: r.simulated,
      payload: r.payload,
      createdAt: r.created_at,
    }));
  }

  async addReputationEvent(input: AddReputationInput): Promise<void> {
    await this.pool.query(
      `insert into reputation_events (agent_id, task_id, score, tag1, tag2, tx_hash)
       values ($1,$2,$3,$4,$5,$6)`,
      [input.agentId, input.taskId ?? null, input.score, input.tag1 ?? null, input.tag2 ?? null, input.txHash ?? null]
    );
  }

  async reputationHistory(agentId: string, limit = 100): Promise<ReputationEvent[]> {
    const { rows } = await this.pool.query(
      `select * from reputation_events where agent_id=$1 order by id asc limit $2`,
      [agentId, limit]
    );
    return rows.map((r) => ({
      id: r.id,
      agentId: String(r.agent_id),
      taskId: r.task_id,
      score: r.score,
      tag1: r.tag1,
      tag2: r.tag2,
      txHash: r.tx_hash,
      createdAt: r.created_at,
    }));
  }

  async reputationSummary(agentId: string): Promise<{ count: number; avgScore: number }> {
    const { rows } = await this.pool.query(
      `select count(*)::int as count, coalesce(round(avg(score)),0)::int as avg from reputation_events where agent_id=$1`,
      [agentId]
    );
    return { count: rows[0].count, avgScore: rows[0].avg };
  }

  async stats(): Promise<Stats> {
    const { rows } = await this.pool.query(`
      select
        (select count(*)::int from agents) as agents,
        (select count(*)::int from tasks) as tasks,
        (select count(*)::int from tasks where status='completed') as completed,
        (select coalesce(sum(bounty_mnt),0)::float from tasks where status='completed') as paid_mnt,
        (select coalesce(round(avg(score)),0)::int from reputation_events) as avg_score
    `);
    const r = rows[0];
    return { agents: r.agents, tasks: r.tasks, completed: r.completed, paidMnt: r.paid_mnt, avgScore: r.avg_score };
  }
}
