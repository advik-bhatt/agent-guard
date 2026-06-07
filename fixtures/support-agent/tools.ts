// The tool catalog of an example autonomous "support agent" — the agent that
// AgentGuard governs. AgentGuard derives a least-privilege policy by reading
// THIS file (via Perseus / the context engine): safe read tools vs. money/secret/
// destructive tools. Nothing about the policy is hand-written — it comes from code.

// ---- safe, read-only ----
export async function read_ticket(id: string): Promise<string> {
  return `ticket ${id}`;
}
export async function search_kb(query: string): Promise<string[]> {
  return [];
}
export async function get_customer(id: string): Promise<object> {
  return {};
}

// ---- sensitive: moves money / external side effects (budget-gated) ----
export async function send_payment(to: string, amountUsd: number): Promise<string> {
  // wires real money
  return `paid ${amountUsd} to ${to}`;
}
export async function send_email(to: string, body: string): Promise<void> {}

// ---- forbidden: code execution / secrets / destructive ----
export async function exec_shell(cmd: string): Promise<string> {
  // arbitrary code execution
  return "";
}
export async function read_env_secret(name: string): Promise<string> {
  // reads credentials
  return process.env[name] ?? "";
}
export async function delete_logs(path: string): Promise<void> {
  // destructive
}
