import { config, llmProvider } from "./config";
import { callClaude, clampScore, extractJson } from "./llm";
import type { VerifierResult, WorkerResult } from "./types";
import type { DemoTask } from "./demoTasks";

const SYSTEM = `You are a strict, fair AI quality verifier. Given a task and a worker agent's output, evaluate how well the output satisfies the task.
Return ONLY a valid JSON object with exactly these keys:
{
  "score": number,        // 0-100, be strict but fair
  "reasoning": string,    // one sentence explaining the score
  "strengths": string,    // one short phrase
  "weaknesses": string,   // one short phrase, or "none"
  "approved": boolean     // true only if the work genuinely meets the task's bar
}
No markdown, no prose outside the JSON.`;

export async function runVerifier(task: DemoTask, work: WorkerResult): Promise<VerifierResult> {
  if (llmProvider() === "mock") {
    await new Promise((r) => setTimeout(r, 600));
    // Grade near the worker's mock confidence so the pass/fail arc is deterministic.
    const score = clampScore(work.confidence - 4, 50);
    const approved = score >= config.threshold;
    return {
      score,
      approved,
      reasoning: approved
        ? "Clear decision, sound reasoning, and an actionable plan that directly answers the task."
        : "The output cannot satisfy the task as specified, so it falls short of the acceptance bar.",
      strengths: approved ? "structured, decisive, actionable" : "intellectually honest",
      weaknesses: approved ? "none" : "does not deliver the requested artifact",
      raw: "(mock verifier — set ANTHROPIC_API_KEY for live agents)",
    };
  }

  const raw = await callClaude({
    model: config.verifierModel,
    system: SYSTEM,
    user: `TASK:\n${task.description}\n\nWORKER OUTPUT:\n${work.result}\n\nWorker's stated methodology: ${work.methodology}\nWorker's stated confidence: ${work.confidence}`,
    maxTokens: 1000,
  });

  const parsed = extractJson<Partial<VerifierResult>>(raw);
  const score = clampScore(parsed.score, 0);
  // The contract enforces the threshold too; we keep the agent's intent but make
  // "approved" consistent with the on-chain rule.
  const approved = (parsed.approved ?? score >= config.threshold) && score >= config.threshold;
  return {
    score,
    approved,
    reasoning: String(parsed.reasoning ?? "").trim(),
    strengths: String(parsed.strengths ?? "").trim(),
    weaknesses: String(parsed.weaknesses ?? "none").trim(),
    raw,
  };
}
