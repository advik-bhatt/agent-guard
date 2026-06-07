# sample-project (verification fixture)

A tiny TypeScript library used by AgentWork's demo. Monetary amounts are integer
**cents** everywhere (`$19.99` → `1999`).

`formatPrice(cents)` is defined in `src/money.ts` and called from `src/cart.ts`
and `src/checkout.ts`. That cross-file dependency is the point: a change to
`formatPrice` that ignores its callers is a real, silent bug — exactly the kind
of thing a context-aware verifier (Perseus) catches and a context-blind reviewer
misses.
