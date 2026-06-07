// Empty string => same-origin (Replit single-port prod build). Unset => local dev.
export const BACKEND = import.meta.env.DEV
  ? "http://localhost:3001"
  : ((import.meta.env.VITE_BACKEND_URL as string | undefined) || "");
export const EXPLORER =
  (import.meta.env.VITE_MANTLE_EXPLORER as string | undefined) ||
  "https://explorer.sepolia.mantle.xyz";

export interface StreamHandlers {
  onEvent: (event: Record<string, unknown>) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export function streamGuard(handlers: StreamHandlers, ticket?: string): () => void {
  const q = ticket && ticket.trim() ? `?ticket=${encodeURIComponent(ticket.trim())}` : "";
  const es = new EventSource(`${BACKEND}/api/guard/demo${q}`);
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
      /* ignore */
    }
  };
  es.onerror = () => {
    if (done) return;
    es.close();
    handlers.onError(`Lost connection to the backend (${BACKEND}). Is it running?`);
  };
  return () => {
    done = true;
    es.close();
  };
}
