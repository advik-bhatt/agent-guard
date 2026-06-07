import type { Tx } from "../types";
import { truncateHash } from "../util";

export function ChainProof({
  txs,
  payment,
  reputationUpdated,
}: {
  txs: Tx[];
  payment?: { amount: string; url: string; simulated: boolean };
  reputationUpdated?: boolean;
}) {
  return (
    <section className="card proof">
      <div className="card-title">
        <span>Blockchain Proof</span>
        <span className="badge badge-mantle">Mantle Sepolia</span>
      </div>

      <div className="tx-list">
        {txs.length === 0 && <div className="muted">No transactions yet.</div>}
        {txs.map((t, i) => (
          <a key={i} className="tx-row" href={t.url} target="_blank" rel="noreferrer">
            <span className="tx-label">{t.label}</span>
            <span className="tx-hash">
              {truncateHash(t.hash)}
              {t.simulated && <span className="tx-sim">sim</span>}
            </span>
          </a>
        ))}
      </div>

      {payment && (
        <div className="payment">
          <div className="payment-dot" />
          <div>
            <div className="payment-amt">PAYMENT SENT</div>
            <div className="payment-sub">{payment.amount} → worker wallet</div>
          </div>
        </div>
      )}

      {reputationUpdated && (
        <div className="rep-updated">★ Reputation Registry updated (ERC-8004)</div>
      )}
    </section>
  );
}
