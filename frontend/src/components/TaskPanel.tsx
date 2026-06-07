import type { Status } from "../types";

const STATUS_CLASS: Record<Status, string> = {
  Idle: "chip-idle",
  Open: "chip-open",
  Claimed: "chip-open",
  Submitted: "chip-open",
  Completed: "chip-ok",
  Failed: "chip-bad",
};

export function TaskPanel({
  title,
  description,
  bounty,
  status,
}: {
  title?: string;
  description?: string;
  bounty: string;
  status: Status;
}) {
  return (
    <section className="card task">
      <div className="card-title">
        <span>Task</span>
        <span className="badge badge-amber">{bounty} MNT</span>
      </div>

      <div className="task-head">
        <div className="task-title">{title ?? "Select a task and run the demo"}</div>
        <span className={`chip ${STATUS_CLASS[status]}`}>{status}</span>
      </div>

      <p className="task-desc">{description ?? "—"}</p>
    </section>
  );
}
