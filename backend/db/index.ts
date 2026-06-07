import { MemoryRepo } from "./memory";
import { PostgresRepo } from "./postgres";
import type { Repo } from "./repo";

export * from "./repo";

let instance: Repo | null = null;
let initPromise: Promise<Repo> | null = null;

// Provider-neutral: Postgres when DATABASE_URL is set (Replit, Neon, RDS, local…),
// otherwise an in-memory store so the app boots with zero setup.
export function getDb(): Promise<Repo> {
  if (instance) return Promise.resolve(instance);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const url = process.env.DATABASE_URL;
    let repo: Repo;
    if (url) {
      repo = new PostgresRepo(url);
      try {
        await repo.init();
        console.log("[db] postgres connected");
      } catch (err) {
        console.error("[db] postgres init failed, falling back to in-memory:", (err as Error).message);
        repo = new MemoryRepo();
        await repo.init();
      }
    } else {
      repo = new MemoryRepo();
      await repo.init();
      console.log("[db] in-memory (set DATABASE_URL for persistence)");
    }
    instance = repo;
    return repo;
  })();

  return initPromise;
}
