import { config, llmProvider } from "./config";
import { callClaude, clampScore, extractJson } from "./llm";
import type { WorkerResult } from "./types";
import type { DemoTask } from "./demoTasks";

const SYSTEM = `You are a precise AI worker agent with an on-chain identity. You take a task and complete it thoroughly and concretely.
Return ONLY a valid JSON object with exactly these keys:
{
  "result": string,        // your complete, well-structured answer
  "methodology": string,   // one sentence on your approach
  "confidence": number     // 0-100, your honest confidence in the result
}
No markdown, no prose outside the JSON.`;

export async function runWorker(task: DemoTask): Promise<WorkerResult> {
  if (llmProvider() === "mock") {
    // Small delay so the live "agent is working" UI reads naturally.
    await new Promise((r) => setTimeout(r, 600));
    return { ...task.mock, raw: "(mock agent — set ANTHROPIC_API_KEY for live agents)" };
  }

  const raw = await callClaude({
    model: config.workerModel,
    system: SYSTEM,
    user: `Task:\n${task.description}`,
    maxTokens: 2000,
  });

  const parsed = extractJson<Partial<WorkerResult>>(raw);
  return {
    result: String(parsed.result ?? "").trim(),
    methodology: String(parsed.methodology ?? "").trim(),
    confidence: clampScore(parsed.confidence, 50),
    raw,
  };
}
