import type { WorkerResult } from "./types";

export interface DemoTask {
  id: string;
  title: string;
  description: string;
  /** Narrative hint for the mock path; live agents decide for themselves. */
  expectPass: boolean;
  mock: WorkerResult;
}

export const DEMO_TASKS: DemoTask[] = [
  {
    id: "strategy",
    title: "Startup strategy call",
    description:
      "You are an AI business analyst. A startup with $500K runway is choosing between (A) building a B2C app with a 5,000-person waitlist, or (B) landing one enterprise customer at $200K ARR. Provide a structured recommendation with: a clear decision, 3 key reasons, the single biggest risk, and a 90-day action plan.",
    expectPass: true,
    mock: {
      result:
        "DECISION: Pursue (B) — land the $200K ARR enterprise customer first.\n\n3 KEY REASONS:\n1. Runway math: $200K ARR covers ~5 months of additional runway and proves willingness-to-pay, which a waitlist does not.\n2. Signal quality: a signed enterprise contract is far stronger evidence for the next raise than 5K unconverted signups.\n3. Optionality: enterprise revenue funds the B2C build later; the reverse (B2C first) burns the runway before validation.\n\nBIGGEST RISK: Single-customer concentration — the roadmap bends to one buyer and churn is existential. Mitigate by capping bespoke work at 20% and keeping the core product general.\n\n90-DAY PLAN:\n- Days 1-30: Close the contract; scope an MVP that is 80% reusable across future customers.\n- Days 31-60: Ship to the customer; instrument usage; collect 3 reference quotes.\n- Days 61-90: Convert learnings into a repeatable sales motion; open a design-partner pipeline of 5 logos.",
      methodology:
        "Weighed runway impact, evidence quality for fundraising, and downstream optionality, then stress-tested the recommendation against concentration risk.",
      confidence: 92,
    },
  },
  {
    id: "blockchain_value",
    title: "Where on-chain agents beat fintech",
    description:
      "Identify 3 concrete use cases where AI agents autonomously handling financial transactions on a blockchain create more value than traditional fintech. For each, give: the use case name, why a blockchain (not a database) is necessary, and an estimated time savings versus the current process.",
    expectPass: true,
    mock: {
      result:
        "1. AGENT-TO-AGENT SETTLEMENT — Autonomous services paying each other per call.\n   Why chain: no shared bank, no chargebacks, atomic settlement across orgs/borders; the registry of who-paid-whom is the product.\n   Time savings: instant vs. 2-3 day ACH / 30-day net terms.\n\n2. VERIFIABLE WORK PAYROLL — Paying agents only when output is independently graded (this demo).\n   Why chain: escrow + verdict + reputation are enforced by code, not a trusted middleman; reputation is portable across employers.\n   Time savings: minutes vs. days of invoice review / dispute cycles.\n\n3. MACHINE MICROPAYMENTS FOR DATA/COMPUTE — Sub-cent metered payments between agents.\n   Why chain: card rails can't economically clear $0.001; on-chain micropayments can.\n   Time savings: real-time metering vs. monthly reconciliation.",
      methodology:
        "Filtered for cases where trustless settlement, atomicity, or sub-cent economics make a database strictly insufficient.",
      confidence: 90,
    },
  },
  {
    id: "stress",
    title: "Stress test (shows the verifier's teeth)",
    description:
      "Provide the exact USD/EUR exchange rate 30 days from today as a single guaranteed-correct number, with a rigorous closed-form derivation proving the figure cannot be wrong.",
    expectPass: false,
    mock: {
      result:
        "A specific future FX rate cannot be derived in closed form or guaranteed — spot rates are driven by stochastic, news-dependent flows. The honest answer is a probabilistic range (e.g., a forward-implied central estimate with a confidence band), not a single guaranteed number. Presenting one figure as 'proven correct' would be misleading.",
      methodology: "Declined the impossible guarantee and reframed toward a defensible probabilistic estimate.",
      confidence: 41,
    },
  },
];

export function getTask(id: string | undefined): DemoTask {
  return DEMO_TASKS.find((t) => t.id === id) || DEMO_TASKS[0];
}
