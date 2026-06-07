import type { Identity, Reputation } from "../types";
import { EXPLORER } from "../api";
import { isAddress, truncateHash } from "../util";

export function AgentIdentity({
  identity,
  reputation,
}: {
  identity?: Identity;
  reputation?: Reputation;
}) {
  const score = reputation?.avgScore ?? null;
  const wallet = identity?.workerWallet ?? "";

  return (
    <section className="card identity">
      <div className="card-title">
        <span>Worker Identity</span>
        {identity && <span className="badge badge-green">ERC-8004 Registered</span>}
      </div>

      <div className="identity-id">AI Agent #{identity?.workerAgentId ?? "—"}</div>

      <div className="identity-wallet">
        {wallet ? (
          isAddress(wallet) ? (
            <a href={`${EXPLORER}/address/${wallet}`} target="_blank" rel="noreferrer">
              {truncateHash(wallet)}
            </a>
          ) : (
            <span>{wallet}</span>
          )
        ) : (
          <span className="muted">wallet —</span>
        )}
      </div>

      <div className="rep-block">
        <div className={`rep-score ${score !== null && score >= (identity?.threshold ?? 65) ? "ok" : score !== null ? "bad" : ""}`}>
          {score !== null ? score : "—"}
        </div>
        <div className="rep-label">
          on-chain reputation
          <br />
          <span className="muted">{reputation?.count ?? 0} job(s) scored</span>
        </div>
      </div>

      <div className="identity-foot muted">
        Identity & reputation are ERC-8004 registries on Mantle.
      </div>
    </section>
  );
}
