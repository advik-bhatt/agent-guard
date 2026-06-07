import Anthropic from "@anthropic-ai/sdk";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { config, llmProvider } from "./config";

let anthropic: Anthropic | null = null;
let bedrock: BedrockRuntimeClient | null = null;

function getAnthropic(): Anthropic {
  if (!anthropic) anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  return anthropic;
}

function getBedrock(): BedrockRuntimeClient {
  if (!bedrock) bedrock = new BedrockRuntimeClient({ region: config.awsRegion });
  return bedrock;
}

export interface CallOpts {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}

/**
 * Calls Claude and returns the raw text. Provider is resolved at runtime:
 *   bedrock  → AWS Bedrock InvokeModel (sponsor path, BEDROCK_ENABLED=true)
 *   anthropic→ Anthropic API (default when ANTHROPIC_API_KEY is set)
 *   mock     → callers fall back to canned output (no key required)
 */
export async function callClaude(opts: CallOpts): Promise<string> {
  const provider = llmProvider();
  const maxTokens = opts.maxTokens ?? 2000;

  if (provider === "bedrock") {
    const command = new InvokeModelCommand({
      modelId: config.bedrockModelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      }),
    });
    const res = await getBedrock().send(command);
    const payload = JSON.parse(new TextDecoder().decode(res.body));
    return (payload.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
  }

  // Anthropic API. No sampling params (Opus 4.8 rejects them); JSON is enforced
  // via the system prompt and parsed defensively in extractJson().
  const msg = await getAnthropic().messages.create({
    model: opts.model,
    max_tokens: maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** Robustly pull a JSON object out of a model response (handles ``` fences / prose). */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json/gi, "```").trim();

  // First try the whole thing.
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* fall through */
  }

  // Scan for the first balanced {...} block.
  const start = cleaned.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') inStr = !inStr;
      if (inStr) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(cleaned.slice(start, i + 1)) as T;
        }
      }
    }
  }
  throw new Error("No JSON object found in model response");
}

export function clampScore(n: unknown, fallback = 0): number {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return fallback;
  return Math.max(0, Math.min(100, v));
}
