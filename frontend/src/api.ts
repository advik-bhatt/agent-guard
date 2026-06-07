import type { TaskMeta } from "./types";

export const BACKEND =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) || "http://localhost:3001";
export const EXPLORER =
  (import.meta.env.VITE_MANTLE_EXPLORER as string | undefined) ||
  "https://explorer.sepolia.mantle.xyz";

export async function fetchTasks(): Promise<TaskMeta[]> {
  const res = await fetch(`${BACKEND}/api/tasks`);
  if (!res.ok) throw new Error("failed to load tasks");
  return res.json();
}

export interface StreamHandlers {
  onEvent: (event: Record<string, unknown>) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/** Opens the SSE demo stream. Returns a stop() to close it early. */
export function streamDemo(taskId: string, handlers: StreamHandlers): () => void {
  const es = new EventSource(`${BACKEND}/api/demo?task=${encodeURIComponent(taskId)}`);
  let done = false;

  es.onmessage = (ev) => {
    if (ev.data === "[DONE]") {
      done = true;
      es.close();
      handlers.onDone();
      return;
    }
    try {
      handlers.onEvent(JSON.parse(ev.data));
    } catch {
      /* ignore malformed frame */
    }
  };

  es.onerror = () => {
    if (done) return;
    es.close();
    handlers.onError("Lost connection to the backend. Is it running on " + BACKEND + "?");
  };

  return () => {
    done = true;
    es.close();
  };
}
